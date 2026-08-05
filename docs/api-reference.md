# API-справочник

Публичные функции модулей прошивки и UI. Канонические определения — в
заголовочных файлах; здесь — краткая справка.

## 1. Прошивка

### `shared/dsp/dsp_param_update.h` — engine параметров

```c
esp_err_t dsp_param_init(const dsp_config_t *initial);      // оба буфера = копия initial; создаёт очередь уведомлений
const dsp_config_t *dsp_param_get_active(void);            // атомарное чтение active_ptr (аудио-задача)
uint8_t dsp_param_apply(const uint8_t *msg, uint16_t len); // разбор BLE_PARAM_UPDATE → staging + recalc биквадов
void dsp_param_commit(void);                               // swap staging↔active (ТОЛЬКО аудио-задача)
uint8_t dsp_param_apply_bulk(const uint8_t *data, size_t len); // валидация блоба → staging → notify (без commit)
void dsp_param_notify_update(void);                        // xQueueOverwrite очереди уведомлений (depth 1)
bool dsp_param_poll_update(void);                          // неблокирующая проверка очереди (аудио-задача)
void dsp_param_refresh_crc_in_place(dsp_config_t *cfg);    // пересчёт CRC-32 в снапшоте (для SYNC_CONFIG)
```

Жизненный цикл: `apply` (serial-задача) → `notify` → аудио-задача в конце чанка
`poll` → `commit`. Возврат `apply*` — `BLE_STATUS_*`.

### `shared/dsp/msg_handler.h` — транспорт-агностичный роутер

```c
typedef struct {
    void (*send_ack)(uint8_t msg_id, uint8_t status);
    void (*send_error)(uint8_t msg_id, uint8_t status, uint8_t detail);
    void (*send_config)(const uint8_t *data, size_t len);
    void (*send_telemetry)(const dsp_telemetry_t *stats);
} msg_transport_t;

void msg_handler_init(const msg_transport_t *transport);
void msg_handler_process(const uint8_t *payload, uint8_t len); // PING/SYNC/SAVE/PARAM/BULK
void msg_handler_post_telemetry(const dsp_telemetry_t *stats); // из аудио-задачи (Core 1)
bool msg_handler_flush_telemetry(void);                        // из transport-задачи (Core 0)
```

Транспорт обязан реализовать `msg_transport_t`. Внутреннее состояние: `bulk_buffer`
(3772 Б), `bulk_offset`, `bulk_expected`, снапшот телеметрии.

### `shared/dsp/dsp_pipeline.c`

```c
void dsp_pipeline_init(void);        // обнуление состояний биквадов и линий задержки
void dsp_pipeline_process(const dsp_config_t *cfg, float in_l, float in_r, float out[4]); // IRAM, per-sample
```

### `shared/dsp/dsp_config.h` — структуры

`dsp_config_t` (3772 Б, pack 4) — см. `wire-protocol.md` §4. Константы:
`DSP_MAGIC 0x44535043`, `DSP_VERSION 4`, `DSP_MAX_PEQ_BANDS 10`,
`DSP_MAX_ROOM_EQ_BANDS 10`, `DSP_MAX_XO_STAGES 4`, `DSP_NUM_INPUTS 2`,
`DSP_NUM_OUTPUTS 4`, `MAX_DELAY_SAMPLES 960`.

### `shared/dsp/ble_protocol.h` — wire-константы и структуры

Типы: `BLE_MSG_PARAM_UPDATE 0x01`, `BLE_MSG_BULK_CONFIG 0x02`,
`BLE_MSG_ACK 0x80`, `BLE_MSG_ERROR 0x82`. Блоки `BLE_BLOCK_{INPUT,OUTPUT,ROUTING,GLOBAL,SYSTEM}`
0x01..0x05. Параметры — см. `wire-protocol.md` §3.1. Структуры:
`ble_param_msg_header_t` (6 Б), `ble_param_msg_f32_t` (10 Б), `ble_param_msg_u8_t` (7 Б),
`ble_ack_msg_t` (3 Б), `ble_error_msg_t` (4 Б), `ble_device_info_t` (12 Б).
Хелперы: `ble_param_value_size(param_type)` → 4/1/0;
`ble_validate_param_msg_len(data, len)` → bool.

### `shared/dsp/serial_protocol.h` — serial-слой

```c
static inline uint8_t serial_crc8(const uint8_t *data, size_t length);   // poly 0x07
static inline size_t serial_frame_encode(payload, payload_len, out_frame);
```

Константы: `SERIAL_BAUD_RATE 115200`, `SERIAL_FRAME_HEADER_0 0xAA`,
`SERIAL_FRAME_HEADER_1 0x55`, `SERIAL_MAX_FRAME_SIZE 256`,
`SERIAL_MAX_PAYLOAD_SIZE 252`, `SERIAL_MSG_{PING 0xA0, PONG 0xA1, SYNC_CONFIG 0xA2,
LOG 0xA3, TELEMETRY 0xA4, SAVE_CONFIG 0xA5}`, `dsp_telemetry_t` (24 Б).

### `main/usb_audio.h`

```c
esp_err_t usb_audio_init(uint32_t sample_rate); // ring buffer + UAC + drift PI timer
void usb_audio_start(void);                     // UsbAudioT на Core 1
void usb_audio_stop(void);                      // (жизненный цикл; в продакшене не используется)
```

### `main/i2s_audio.h`

```c
esp_err_t i2s_audio_init_dual_output(uint32_t sample_rate); // I2S0+1, GPIO из Kconfig
void i2s_audio_write_dual(const uint8_t *buf_i2s0, const uint8_t *buf_i2s1, size_t size);
void i2s_audio_reconfig_sample_rate(int sample_rate);       // (не используется)
void i2s_audio_deinit(void);                                // (не используется)
```

### `main/serial_server.h`

```c
esp_err_t serial_server_init(void);    // UART0, 115200, RX-задача
void serial_server_start(void);        // запуск задачи serial_rx
void serial_server_attach_logs(void);  // перехват ESP_LOG → SERIAL_MSG_LOG
void serial_server_stop(void);         // (жизненный цикл)
```

### `main/main.c`

```c
void app_main(void);                       // инициализация и запуск всего
void save_config_to_nvs_immediate(void);   // NVS-сохранение по команде (msg_handler)
```

## 2. UI (TypeScript)

### `src/hooks/useWebSerial.ts`

```ts
interface WebSerialState { connected; connecting; portName; error; latency }

const {
  state,                          // WebSerialState
  connect,                        // async () => Promise<void>  — navigator.serial.requestPort + open
  disconnect,                     // async () => Promise<void>
  sendParam,                      // (data: Uint8Array) => void  — фрейм уже готов
  sendBulkConfig,                 // async (config: DSPConfig) => Promise<boolean>
  onStatus,                       // (cb: (msg: BLEAckMsg | BLEErrorMsg) => void) => unsub
  onLog,                          // (cb: (text: string) => void) => unsub
  onTelemetry,                    // (cb: (data: DSPTelemetry) => void) => unsub
  onConfig,                       // (cb: (config: DSPConfig) => void) => unsub
  requestConfig,                  // () => void  — шлёт SERIAL_MSG_SYNC_CONFIG
} = useWebSerial();
```

Константы: `ACK_TIMEOUT_MS 300`, `MAX_IN_FLIGHT 4`, `MAX_RETRIES 3`,
`AUTO_RECONNECT_DELAY_MS 2000`, `PING_INTERVAL_MS 5000`, `PONG_TIMEOUT_MS 2000`,
`BULK_RX_TIMEOUT_MS 5000`.

### `src/ble/param-encoder.ts`

`getNextMsgId()` (rolling 0..255, пропуская 0xA0/0xA2/0xA5), `resetMsgId()`,
`encodeParamUpdate(msg)`, и хелперы на каждый параметр:

`encodeGainUpdate` `encodeMuteUpdate` `encodePhaseUpdate` ·
`encodeEQBandEnable|Freq|Gain|Q|Type` `encodeEQBandUpdate` ·
`encodeRoomEQBandEnable|Freq|Gain|Q|Type` ·
`encodeCrossoverUpdate(ch, 'hp'|'lp', 'enable'|'freq'|'type'|'slope', v)` ·
`encodeDelayUpdate` · `encodeRoutingEnable` `encodeRoutingGain` `encodeRoutingUpdate` ·
`encodeMasterVolume` · `encodeDriftKp|Ki|TargetFill|MaxPpm`.

Входные громкости — в dB, на провод конвертирует `dbToLinear` (gain, master volume).

### `src/types/serial-protocol.ts`

`encodeSerialFrame(payload) → Uint8Array` (фрейм `AA 55 len payload crc8`),
`decodeSerialFrame(frame) → { valid, payload }`, `decodeTelemetry(payload) → DSPTelemetry|null`,
`crc8(data)`. Зеркало C-файла.

### `src/export/binary-encoder.ts` / `binary-decoder.ts` / `checksum.ts`

`encodeDSPConfig(config, drift) → ArrayBuffer` (3772 Б; заново считает биквады из
shadow-параметров и CRC-32), `decodeDSPConfig(buffer) → DSPConfig|null` (defensive),
`crc32(data) → number` (IEEE 802.3).

### `src/store/dsp-store.ts` и слайсы

`useDSPStore()` — Zustand, persist в localStorage (`esp32-dsp-config`, debounce 300 мс).
Слайсы: `input-slice`, `routing-slice`, `output-slice`, `global-slice`,
`preset-slice`, `link-slice`, `serial-slice`, `room-eq-slice`, `drift-slice`,
`custom-sum-slice`. `isApplyingDeviceConfig()` — флаг подавления эха при
подстановке конфига с устройства.

### `src/serial/serial-middleware.ts`

`createSerialMiddleware(store, send) → unsub` — diff-подписка: immediate для
дискретных, debounce 50 мс для непрерывных параметров; пропуск при
`!serialConnected` или `isApplyingDeviceConfig()`.

### `src/dsp/*` (вычисления)

`biquad.ts` (cookbook + DF-IIT), `crossover.ts` (LR/BW каскады),
`frequency-response.ts` (комплексная АЧХ и суммы), `utils.ts`
(`dbToLinear`/`linearToDb`).
