# Спецификация wire-протокола

Два уровня: **serial-транспорт** (Web Serial ↔ UART0) поверх **BLE-совместимых
сообщений** (формат payload — единый для serial и бывшего BLE-транспорта).

Канонические источники (обязаны быть в синхроне):
- C: `dq-dsp-firmware/shared/dsp/serial_protocol.h`, `shared/dsp/ble_protocol.h`
- TS: `dq-dsp-ui/src/types/serial-protocol.ts`, `types/ble-protocol.ts`

## 1. Serial-фрейм

```
0xAA 0x55 | length (1 байт) | payload (length байт) | CRC-8 (1 байт)
```

| Поле | Значение |
|---|---|
| Header | `0xAA 0x55` |
| `length` | 0..252 (`SERIAL_MAX_PAYLOAD_SIZE = 256 − 4`) |
| CRC-8 | полином `0x07`, init 0x00, без отражений/final XOR; покрывает `length + payload` |

Транспорт: **UART0 @ 115200 8N1** через USB-Serial-JTAG мост DevKitC-1.
Приём — байтовая state-machine `rx_process_byte` с батч-чтением
(`serial_server.c`). CRC считается на лету.

## 2. Serial-управляющие сообщения (однобайтовый payload)

| Байт | Константа | Действие устройства |
|---|---|---|
| `0xA0` | `SERIAL_MSG_PING` | ACK(`0, OK`) или PONG `0xA1` (transport-level) |
| `0xA1` | `SERIAL_MSG_PONG` | ответ на PING (только устройство→хост) |
| `0xA2` | `SERIAL_MSG_SYNC_CONFIG` | дамп активного конфига bulk-фреймами + ACK |
| `0xA3` | `SERIAL_MSG_LOG` | ESP_LOG-строка (устройство→хост) |
| `0xA4` | `SERIAL_MSG_TELEMETRY` | телеметрия (устройство→хост, 1 Гц) |
| `0xA5` | `SERIAL_MSG_SAVE_CONFIG` | запись конфига в NVS + ACK |

**Защита от коллизий msg_id (фикс аудита H1, коммит `2b27d72`)**: control-сообщения
распознаются только при `payload_len == 1`. Параметрический апдейт (≥ 7 байт) с
`msg_id ∈ {0xA0, 0xA2, 0xA5}` не может быть ошибочно принят за control-сообщение.
UI дополнительно пропускает эти ID в `getNextMsgId()`.

## 3. BLE-сообщения (payload внутри serial-фрейма)

Все multi-byte значения — little-endian. Первые два байта payload всегда
`msg_id | msg_type`.

### 3.1 Параметрический апдейт — `BLE_MSG_PARAM_UPDATE (0x01)`

```
[0] msg_id        u8   (0..255, rolling)
[1] msg_type      u8   = 0x01
[2] target_block  u8   BLE_BLOCK_*
[3] channel       u8   0-based; для routing — входной индекс
[4] param_type    u8   BLE_PARAM_*
[5] param_index   u8   индекс полосы EQ; для routing — выходной индекс
[6..] value       u8 (1 байт) или float32 LE (4 байта)
```

Размер: 7 байт (u8-значение) или 10 байт (float32). Проверка длины:
`ble_validate_param_msg_len()`.

| Блок | `BLE_BLOCK_*` | Параметры |
|---|---|---|
| Input | `0x01` | GAIN 0x01(f), MUTE 0x02(u), PHASE 0x03(u), EQ_BAND_{ENABLE 0x10(u), FREQ 0x11(f), GAIN 0x12(f), Q 0x13(f), TYPE 0x14(u)} |
| Output | `0x02` | те же базовые + DELAY 0x40(f), CROSSOVER_{HP 0x20-, LP 0x30-}{ENABLE(u), FREQ(f), TYPE(u), SLOPE(u)} |
| Routing | `0x03` | ROUTING_ENABLE 0x50(u), ROUTING_GAIN 0x51(f) |
| Global | `0x04` | MASTER_VOLUME 0x60(f) |
| System | `0x05` | DRIFT_KP 0x80(f), DRIFT_KI 0x81(f), DRIFT_TARGET 0x82(f), DRIFT_MAX_PPM 0x83(f) |
| Input (Room EQ) | — | ROOM_EQ_BAND_{ENABLE 0x70(u), FREQ 0x71(f), GAIN 0x72(f), Q 0x73(f), TYPE 0x74(u)} |

Типы фильтров: `0x00` peaking, `0x01` low shelf, `0x02` high shelf, `0x03` low pass,
`0x04` high pass, `0x05` band pass, `0x06` notch, `0x07` all pass.
Кроссовер: `0x00` Butterworth, `0x01` Linkwitz-Riley; slope — число каскадов:
`0x01` = 12 dB/oct, `0x02` = 24, `0x04` = 48.

Устройство отвечает **ACK** (`0x80`) или **ERROR** (`0x82`) с тем же `msg_id`.

### 3.2 ACK — `BLE_MSG_ACK (0x80)` (3 байта)

```
[0] msg_id, [1] 0x80, [2] status_code
```

### 3.3 ERROR — `BLE_MSG_ERROR (0x82)` (4 байта)

```
[0] msg_id, [1] 0x82, [2] status_code, [3] detail
```

| Status | Значение |
|---|---|
| `0x00` OK | принято |
| `0x01` INVALID_PARAM | неверная длина/блок/тип/значение |
| `0x02` OUT_OF_RANGE | значение вне диапазона |
| `0x03` BUSY | ресурс занят |
| `0x04` CRC_ERROR | CRC-32 конфига не совпал |

### 3.4 Bulk-конфиг — `BLE_MSG_BULK_CONFIG (0x02)`

Первый фрейм: `[0] msg_id, [1] 0x02, [2] size_lo, [3] size_hi, [4..] первые данные`.
`size` = `sizeof(dsp_config_t)` = **3772 байта**.

```
Первый фрейм:  4-байтный заголовок + чанк (до 248 байт данных)
Континуация:   сырые байты без msg_type (по 252 байта, SERIAL_MAX_PAYLOAD_SIZE)
```

Устройство собирает байты в `bulk_buffer`; при достижении `size` вызывает
`dsp_param_apply_bulk()` и отвечает ACK(OK) или ERROR(CRC_ERROR/INVALID_PARAM/OUT_OF_RANGE).
**Во время активного bulk-приёма все фреймы считаются континуацией** — даже если их
байты совпадают с сигнатурами PING/SYNC/SAVE/PONG/LOG/TELEMETRY (фикс H1: ветка
bulk проверяется до control-сообщений).

### 3.5 SYNC_CONFIG-дамп (устройство → хост)

Та же bulk-схема, направление обратное: первый фрейм с `size`, затем сырые чанки.
CRC-32 активного конфига пересчитывается в снапшоте перед отправкой
(`dsp_param_refresh_crc_in_place`).

## 4. Layout `dsp_config_t` (3772 байта, `#pragma pack(4)`)

| Смещение | Размер | Поле |
|---|---|---|
| 0 | 16 | `header`: magic `0x44535043 'DSPC'`, version u16 (=4), preset_index u16, sample_rate u32, crc32 u32 |
| 16 | 2×728 | `inputs[2]`: gain f32, mute/phase/num_eq_bands/num_room_eq_bands u8, `eq_bands[10]` biquad (5×f32), `eq_params[10]` (16 Б), `room_eq_bands[10]`, `room_eq_params[10]` |
| 1472 | 64 | `routing[2][4]`: enabled u8 + pad3 + gain f32 |
| 1536 | 4×552 | `outputs[4]`: gain f32, delay_samples u32, mute/phase/num_eq_bands/num_hp/num_lp/reserved u8 + pad2, `eq_bands[10]`, `hp_stages[4]`, `lp_stages[4]`, `eq_params[10]`, `hp_params` (8 Б), `lp_params` (8 Б) |
| 3744 | 12 | `global`: master_volume f32, sample_rate u32, reserved u32 |
| 3756 | 16 | `system`: drift_kp/ki/target_fill/max_ppm f32 |
| **3772** | | итого |

`biquad_coeffs_t` = `{b0,b1,b2,a1,a2}` f32 — negated-a конвенция:
`y[n] = b0·x + b1·x[n-1] + b2·x[n-2] + a1·y[n-1] + a2·y[n-2]` (все операции — сложения).
`eq_band_params_t` (16 Б) = `{frequency f32, gain_db f32, q f32, filter_type u8, enabled u8, pad2}`.
`xo_params_t` (8 Б) = `{frequency f32, filter_type u8, slope u8, enabled u8, pad}`.

Структура memory-mappable: бинарник пресета можно кастовать в `const dsp_config_t*`.

## 5. CRC-32 (IEEE 802.3)

- Полином 0xEDB88320 (reflected), init `0xFFFFFFFF`, final XOR `0xFFFFFFFF`.
- Поле `header.crc32` при расчёте обнуляется. Отправляемые хостом блобы обязаны
  иметь корректный CRC — устройство его проверяет до применения.
- Реализации: FW `crc32_ieee` в `dsp_param_update.c`; UI `src/export/checksum.ts`.

## 6. msg_id, ACK и retry (сторона UI)

`useWebSerial.ts`:
- `msg_id` — первый байт payload; UI генерирует rolling 0..255 (`getNextMsgId`),
  пропуская `0xA0/0xA2/0xA5`.
- Отправка через очередь с ограничением **MAX_IN_FLIGHT = 4**;
  **ACK_TIMEOUT_MS = 300**; **MAX_RETRIES = 3** (итого до 4 попыток).
- Таймаут ACK: пере-отправка с инкрементом счётчика; превышение лимита → сообщение
  удаляется из `inFlightRef` и очередь продолжает работу.
- Приём: ACK/ERROR разбираются первыми (по `payload[1]`), пока не идёт активный
  bulk-приём (см. `handleRxPayload`).

## 7. Телеметрия (устройство → хост)

`SERIAL_MSG_TELEMETRY (0xA4)` + 24 байта (`dsp_telemetry_t`, pack 1):
dsp_min_us, dsp_max_us, dsp_avg_us, blocks_processed (u32 ×4), buffer_fill_pct (u8),
3 паддинга, correction_ppm (f32). Декодируется в UI функцией `decodeTelemetry()`.

## 7a. Hex-примеры

Все примеры — полные serial-фреймы `AA 55 | len | payload | crc8`, значения LE.
CRC-8 полином 0x07 покрывает `[len, ...payload]`. Значения байтов сверены скриптом.

**PING** (host → device), payload = `[0xA0]`:

```
AA 55 01 A0 7C
```

Ответ: ACK `msg_id=0` → `AA 55 03 00 80 00 8C` или PONG `AA 55 01 A1 7B`.

**SYNC_CONFIG** (host → device), payload = `[0xA2]`:

```
AA 55 01 A2 72
```

Ответ: BULK_CONFIG первый фрейм `[0, 0x02, size_lo=0xBC, size_hi=0x0E, ...данные]`
(3772 = 0x0EBC) + континуация сырыми чанками + ACK(0, OK).

**Параметрический апдейт: громкость канала.** Громкость шлётся в **линейных**
единицах, не dB. −6 дБ = `10^(-6/20) ≈ 0.50119` = `CE 4D 00 3F` (LE).
`target_block=0x02 (OUTPUT)`, `channel=1`, `param_type=0x01 (GAIN)`, `param_index=0`:

```
AA 55 0A 07 01 02 01 01 00 CE 4D 00 3F C4
```

Разбор payload: `07` msg_id · `01` PARAM_UPDATE · `02` OUTPUT · `01` канал ·
`01` GAIN · `00` idx · `CE 4D 00 3F` float32 LE = 0.50119.

**Апдейт: Q полосы EQ.** `EQ_BAND_Q` — float32. Q=2.0 = `00 00 00 40` LE:

```
AA 55 0A 08 01 01 00 13 05 00 00 00 40 2A
```

`08` msg_id · `01` PARAM_UPDATE · `01` INPUT · `00` ch · `13` Q · `05` полоса ·
`00 00 00 40` = 2.0.

**Апдейт: mute.** u8-значение, полный payload 7 Б:

```
AA 55 07 09 01 01 00 02 00 01 D6
```

`02` = BLE_PARAM_MUTE, значение `01` (включить).

**ACK** (device → host): `[msg_id, 0x80, status]` — подтверждение апдейта с `msg_id=0x07`:

```
AA 55 03 07 80 00 9A
```

**ERROR**: `[msg_id, 0x82, status, detail]` — например OUT_OF_RANGE (0x02):

```
AA 55 04 07 82 02 00 1A
```

**SAVE_CONFIG** (host → device): `[0xA5]` — запись текущего конфига в NVS:

```
AA 55 01 A5 67
```

**TELEMETRY** (device → host): `[0xA4, 24 Б данных]` — 25-байтовый payload
(`dsp_telemetry_t`): 4×u32 (min/max/avg/блоки) + u8 (fill%) + 3 паддинга + f32 (ppm).

**Проверка CRC-8 (полином 0x07)** — на примере `[01 A0]` (length 0x01 + payload A0):

```
crc = 0x00
⊕ 0x01 → 8 сдвигов → 0x07
⊕ 0xA0 → 8 сдвигов → 0x7C
```

→ фрейм `AA 55 01 A0 7C` (совпадает с примером PING выше).

## 8. Рекомендации по расширению

- Любое изменение C-структур **обязательно** обновляет `DSP_VERSION` и TS-зеркала,
  иначе bulk-конфиг будет отклонён по версии.
- Serial-управляющие значения (`0xA0–0xA5`) не должны расширяться в зону `msg_id`
  без тех же `payload_len`-guard'ов.
- При добавлении нового параметра: `BLE_PARAM_*` → `ble_param_value_size()` →
  `dsp_param_apply()` → TS-кодировщик в `param-encoder.ts` → middleware diff.
