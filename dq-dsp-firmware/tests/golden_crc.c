/**
 * Golden test G1: firmware CRC32 vs web UI crc32 (src/export/checksum.ts).
 *
 * Host test — compiles and runs on Linux with plain gcc (no ESP-IDF).
 *
 * The firmware (dsp_param_update.c: crc32_ieee) uses a bitwise CRC-32/IEEE
 * (polynomial 0xEDB88320, init 0xFFFFFFFF, final XOR 0xFFFFFFFF). The web UI
 * (checksum.ts) uses the equivalent table-driven implementation. This test
 * verifies both produce identical output and match the canonical CRC-32
 * check value (CRC of "123456789" == 0xCBF43926).
 *
 * Build & run:
 *   gcc -O2 -o /tmp/crc_golden tests/golden_crc.c && /tmp/crc_golden
 */

#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* ---- Firmware bitwise CRC-32/IEEE (mirror of dsp_param_update.c) ---- */
static uint32_t crc32_ieee_bitwise(const uint8_t *data, size_t len, uint32_t crc)
{
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc & 1u) ? (crc >> 1) ^ 0xedb88320u : (crc >> 1);
        }
    }
    return crc;
}

/* ---- Table-driven CRC-32/IEEE (mirror of checksum.ts) ---- */
static uint32_t s_crc32_table[256];
static int s_table_ready = 0;
static void crc32_init_table(void)
{
    if (s_table_ready) return;
    for (int i = 0; i < 256; i++) {
        uint32_t crc = (uint32_t)i;
        for (int j = 0; j < 8; j++) {
            crc = (crc & 1u) ? (crc >> 1) ^ 0xedb88320u : (crc >> 1);
        }
        s_crc32_table[i] = crc;
    }
    s_table_ready = 1;
}

static uint32_t crc32_ieee_table(const uint8_t *data, size_t len)
{
    crc32_init_table();
    uint32_t crc = 0xffffffffu;
    for (size_t i = 0; i < len; i++) {
        crc = (crc >> 8) ^ s_crc32_table[(crc ^ data[i]) & 0xffu];
    }
    return (crc ^ 0xffffffffu) & 0xffffffffu;
}

/* ---- Full CRC over a buffer (firmware's dsp_param_commit path) ---- */
static uint32_t crc32_full(const uint8_t *data, size_t len)
{
    uint32_t crc = 0xffffffffu;
    crc = crc32_ieee_bitwise(data, len, crc);
    return crc ^ 0xffffffffu;
}

static int fails = 0;

static void check(const uint8_t *data, size_t len, const char *name)
{
    uint32_t bitwise = crc32_full(data, len);
    uint32_t table    = crc32_ieee_table(data, len);
    int ok = (bitwise == table);
    if (!ok) fails++;
    printf("%s  %-28s bitwise=0x%08X table=0x%08X\n",
           ok ? "PASS" : "FAIL", name, bitwise, table);
}

int main(void)
{
    /* Canonical CRC-32 check value: CRC("123456789") == 0xCBF43926 */
    const char *checkstr = "123456789";
    uint32_t canon = crc32_full((const uint8_t *)checkstr, 9);
    int canon_ok = (canon == 0xCBF43926u);
    if (!canon_ok) fails++;
    printf("%s  %-28s crc=0x%08X expected=0xCBF43926\n",
           canon_ok ? "PASS" : "FAIL", "canonical check value", canon);

    /* Empty input */
    check((const uint8_t *)"", 0, "empty");

    /* Short strings */
    check((const uint8_t *)"a", 1, "single byte");
    check((const uint8_t *)"abc", 3, "abc");

    /* A binary blob (non-printable) */
    uint8_t blob[] = { 0x00, 0xFF, 0x10, 0x01, 0x80, 0x7F, 0x00, 0x11 };
    check(blob, sizeof(blob), "binary blob");

    /* 256-byte pattern (table boundary coverage) */
    uint8_t big[256];
    for (int i = 0; i < 256; i++) big[i] = (uint8_t)i;
    check(big, 256, "0x00..0xFF block");

    printf("\n%s (%d checks)\n", fails ? "FAILED" : "ALL PASSED",
           fails ? 0 : 6);
    return fails ? 1 : 0;
}