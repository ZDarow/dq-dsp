/**
 * DSP Pipeline Public API
 */

#ifndef DSP_PIPELINE_H
#define DSP_PIPELINE_H

#include "dsp_config.h"

#ifdef __cplusplus
extern "C" {
#endif

#define DSP_PIPELINE_BLOCK_SIZE 32

void dsp_pipeline_init(void);
void dsp_pipeline_process_block(const dsp_config_t* cfg, const float in_l[], const float in_r[], float out[][4], int len);

#ifdef __cplusplus
}
#endif

#endif /* DSP_PIPELINE_H */
