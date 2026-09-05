/**
 * English translation catalog.
 * Key namespaces mirror the UI structure (toolbar, serial, nav, about, ...).
 */
export const en = {
  common: {
    reset: 'Reset',
    about: 'About',
    apply: 'Apply',
    applied: 'Applied!',
    applying: 'Applying…',
    close: 'Close',
  },
  toolbar: {
    master: 'Master',
    sampleRate: 'Sample Rate',
    masterTooltip:
      'Master volume: {{value}}. Applied after all per-channel processing — the final dB knob before the DAC.',
    sampleRateTooltip:
      'USB device decides sample rate. Change CONFIG_UAC_SAMPLE_RATE in firmware sdkconfig + reflash to set a different value, then macOS Audio MIDI Setup must select it.',
    themeTooltip: 'Switch to {{theme}} theme',
    resetTooltip:
      'Reset all DSP settings (gains, EQ, crossovers, routing, room EQ) back to factory defaults. Does not touch saved presets or device flash.',
    aboutTooltip:
      'Open the About dialog — architecture, pin diagram, ASRC algorithm, and version info',
    aboutLogoTooltip: 'About DQ-DSP — architecture, pin map, software layout',
    aboutAria: 'About DQ-DSP',
    language: 'Language',
  },
  nav: {
    roomEq: 'Room EQ',
    system: 'System',
    input: 'Input {{n}}',
    routing: 'Routing',
    output: 'Output {{n}}',
    roomEqOn: 'Room EQ ON — click to disable',
    roomEqOff: 'Room EQ OFF — click to enable',
    disableRoomEq: 'Disable Room EQ',
    enableRoomEq: 'Enable Room EQ',
  },
  serial: {
    connected: 'Connected',
    connecting: 'Connecting...',
    serial: 'Serial',
    connect: 'Connect Serial',
    disconnect: 'Disconnect',
    console: 'Console',
    sync: 'Sync',
    saveToDevice: 'Save to Device',
    syncTooltip:
      "Sync: pull the device's current configuration into the UI. Use after Connect to mirror the firmware's actual state (sample rate, EQ, routing). Overwrites local UI state.",
    applyTooltip:
      "Apply: push the entire current configuration to the device's runtime RAM. Live for as long as the ESP32 is powered. Use after loading a preset; individual edits already stream automatically.",
    saveTooltip:
      "Save to Device: commit the running configuration into the ESP32's flash so it survives reboot/power-cycle. Audio may stutter briefly during the write.",
    consoleTooltip:
      'Toggle the serial console panel — shows ESP_LOG output from the device plus CPU load and clock-drift charts.',
    connectTooltip:
      'Open a Web Serial connection to the ESP32 (Chrome/Edge only). Once connected, parameter edits stream to the device live.',
    disconnectTooltip:
      'Close the serial port. The device keeps running with its last applied config; reconnect any time to resume live control.',
    unavailable: 'Serial unavailable',
    deviceError: 'Device error: code {{code}}',
    syncLog: '[sync] Pulling config from device…',
    syncAppliedLog: '[sync] Device config applied to UI',
  },
  footer: {
    buildCommit: 'Build commit {{commit}} · {{date}}',
  },
  console: {
    serialLog: 'Serial Log',
    clear: 'Clear',
    waitingLogs: 'Waiting for logs...',
  },
  preset: {
    label: 'Preset:',
    currentName: 'Current Name',
    placeholder: 'Preset name...',
    saveNew: 'Save New',
    save: 'Save',
    saveToFile: 'Save to File',
    loadFiles: 'Load File(s)',
    loadFolder: 'Load Folder',
    empty: 'No saved presets yet. Click "Save New" to save the current config.',
    count: '{{count}} preset saved',
    countPlural: '{{count}} presets saved',
    unsaved: 'Unsaved',
    statusSaved: 'Saved',
    statusModified: 'Modified',
    savedTitle: 'Current state matches the loaded preset',
    modifiedTitle:
      'You have unsaved changes — click Save to overwrite this preset, or Save New to keep both versions',
    unsavedTitle: 'No preset selected — click Save New to store this configuration',
    saveNewTooltip:
      "Append the current configuration as a new preset entry in this browser's localStorage. Doesn't touch the device — use Apply / Save to Device for that.",
    saveTooltipDirty:
      'Overwrite "{{name}}" in this browser\'s localStorage with the current configuration. Doesn\'t touch the device — use Apply / Save to Device for that.',
    saveTooltipClean: 'No changes to save — current state matches the loaded preset',
    saveToFileTooltip:
      'Download the current configuration as a JSON file you can re-import on another machine or check into git. Browser localStorage is unaffected.',
    loadFilesTooltip:
      "Pick one or more JSON preset files to import. Each file becomes a new preset entry; current state isn't replaced unless you click one.",
    loadFolderTooltip:
      'Pick a folder; every .json preset inside gets imported as a new preset entry. Useful for batch-loading a preset library.',
    noValidFiles: 'No valid preset files found.',
    loadTooltip: 'Load "{{name}}" — replaces the current configuration',
    downloadTooltip: 'Download as .json — share or check into git',
    renameTooltip: 'Rename this preset',
    deleteTooltip: "Delete this preset (current state isn't affected)",
    downloadAria: 'Download preset',
    renameAria: 'Rename preset',
    deleteAria: 'Delete preset',
  },
  about: {
    title: 'About DQ-DSP',
    closeAria: 'Close About',
    closeTooltip: 'Close (Esc)',
    author: 'Author',
    featuresTitle: 'What the DSP Can Do',
    cardPerInput: 'Per-Input Processing (×2)',
    cardRouting: '2 × 4 Routing Matrix',
    cardPerOutput: 'Per-Output Processing (×4)',
    cardMaster: 'Master & System',
    cardWorkflow: 'Workflow & Persistence',
    cardAudioPath: 'Audio Path',
    signalFlowTitle: 'Signal Flow Overview',
    pipelineDetailTitle: 'DSP Pipeline Detail',
    wiringTitle: 'Wiring — ESP32-S3 → 2× PCM5102A',
    asrcTitle: 'ASRC — Asynchronous Sample-Rate Conversion',
    softwareTitle: 'Software Architecture',
    checklistTitle: 'Quick Test Checklist',
    checklistTest: 'Test',
    checklistExpected: 'Expected',
    cardCore0: 'Core 0 — Control & USB',
    cardCore1: 'Core 1 — Real-Time Audio',
    cardParamFlow: 'Parameter Update Flow',
    cardKeyFiles: 'Key Files',
    blurb:
      'DQ-DSP is a flexible 2-in / 4-out audio DSP firmware-and-UI for the ESP32-S3, built around USB UAC class-compliant audio plus live serial control. The web UI streams every parameter tweak (gain, EQ, crossover, routing) to the device in real time, with bulk Apply for preset loads and Save-to-Device for NVS persistence.',
    featInput1: 'Gain (−72 to +12 dB), mute, polarity invert',
    featInput2: '<strong>10-band parametric EQ</strong> — peak / shelf / HP / LP / notch',
    featInput3:
      '<strong>10-band Room EQ stage</strong> with REW measurement import + auto-EQ against flat / Harman / tilt targets',
    featInput4: 'Stereo link mirrors edits across both inputs',
    featRouting1: 'Per-crosspoint enable + linear gain (0–100 %)',
    featRouting2: 'Mono-sum, balance, route a single sub off both channels',
    featRouting3: 'Live diff-sent on every edit — no recompile, no reflash',
    featOutput1: 'Gain, mute, polarity invert, delay (0–10 ms, sample-accurate)',
    featOutput2: '<strong>10-band parametric EQ</strong> per output',
    featOutput3:
      '<strong>Crossover</strong> — HP + LP, Linkwitz-Riley or Butterworth, 6 / 12 / 18 / 24 dB/oct slopes',
    featOutput4:
      'Flexible link groups — any-to-any output mirroring (stereo pairs, gang-summed subs, etc.)',
    featOutput5: 'One-shot copy from any output to any other',
    featMaster1: 'Master volume after all per-output processing',
    featMaster2: 'Soft-clip limiter on the final stage',
    featMaster3: 'Drift compensation (ASRC) tunable per device',
    featMaster4: 'Live CPU-load + buffer-fill telemetry charts',
    featMaster5:
      'Acoustic-sum visualization — pick output groups, see their complex sum on the response chart',
    featWorkflow1: 'Browser preset library in localStorage + JSON import / export',
    featWorkflow2: 'Saved/Modified/Unsaved indicator vs the loaded preset',
    featWorkflow3: '<strong>Apply</strong> bulk-pushes the running config to ESP32 RAM',
    featWorkflow4: '<strong>Save to Device</strong> commits to NVS so it survives a power cycle',
    featWorkflow5: 'Light / dark theme; per-channel color identity across sidebar / chart / PEQ',
    featAudio1: 'USB Audio Class 1.0 — 2 ch in / out, 24-bit, 48 kHz',
    featAudio2: 'Dual I2S TX → 2 × PCM5102A (4 channels, 24-bit internal pipeline)',
    featAudio3: 'Sample-rate-agnostic biquads (coeffs recomputed if SR changes)',
    featAudio4: 'Atomic config swap — parameter updates never click or pop',
    sfUSBHost: 'USB Host',
    sfUSBHostSub: 'UAC class',
    sfTinyUSB: 'TinyUSB',
    sfTinyUSBSub: '48 kHz I2S',
    sfRingBuffer: 'Ring Buffer',
    sfRingBufferSub: 'drift-corrected',
    sfASRC: 'ASRC',
    sfASRCSub: 'PI controller',
    sfDspPipeline: 'DSP Pipeline',
    sfDspPipelineSub: 'Core 1',
    sfI2S: '2× I2S TX → 2× PCM5102A',
    sfI2SSub: 'Out 1–4',
    sfWebUI: 'Web UI',
    sfWebSerial: 'Web Serial',
    sfWebSerialSub: 'USB CDC 115200',
    sfSerialServer: 'Serial Server',
    sfSerialServerSub: 'Core 0',
    sfParamEngine: 'Param Engine',
    sfParamEngineSub: 'atomic swap',
    pdStereoIn: 'Stereo In',
    pdStereoInSub: 'L + R float',
    pdInputGain: 'Input Gain',
    pdInputGainSub: 'Phase / Mute',
    pdRoomEq: '10-band Room EQ',
    pdRoomEqSub: '×2 ch',
    pdInputPeq: '10-band Input PEQ',
    pdInputPeqSub: '×2 ch',
    pdRouting: '2×4 Routing',
    pdRoutingSub: 'Matrix',
    pdOutputPeq: 'Output PEQ',
    pdOutputPeqSub: '×4 ch',
    pdCrossover: 'Crossover',
    pdCrossoverSub: 'HP + LP',
    pdGainDelay: 'Gain / Delay',
    pdGainDelaySub: 'Phase / Mute',
    pdOutputs: '4 Outputs',
    pdOutputsSub: 'int16 to DAC',
    pdTypical21Title: 'Typical 2.1 use:',
    pdTypical21:
      'Out 1 = sub (LP 80 Hz), Out 2 = left main (HP 80 Hz), Out 3 = right main (HP 80 Hz), Out 4 = spare.',
    pdTypicalBiampTitle: 'Typical bi-amp use:',
    pdTypicalBiamp:
      'Out 1 = woofer (LP 2 kHz), Out 2 = tweeter (HP 2 kHz LR4), mirror for the other channel on Out 3 + 4.',
    pinUsbSub: 'USB-OTG (UAC) + UART0 (USB-CDC bridge)',
    pinDacLeft: 'Left speaker · Out 1+2',
    pinDacRight: 'Right speaker · Out 3+4',
    pinJumper: 'back-side jumpers: H3L XSMT → HIGH (un-mute)',
    pinSckNote: '→ GND (internal MCLK)',
    pinVinNote: '3.3 V',
    pinLegendI2S0: 'I2S0 → DAC #1',
    pinLegendI2S1: 'I2S1 → DAC #2',
    pinLegend3V3: '3V3 power',
    pinLegendGnd: 'GND (incl. SCK tie)',
    wiringBoard:
      '<strong>GY-PCM5102 / TENSTAR ROBOT board:</strong> front-edge pads in order are <code>SCK · BCK · DIN · LCK · GND · VIN</code>. Tie <code>SCK</code> to <code>GND</code> so the chip generates its own MCLK from BCK. On the back, bridge <code>H3L</code> (XSMT) to the <strong>HIGH</strong> side — default position is LOW (soft-mute = silence). Leave <code>H1L FLT</code>, <code>H2L DEMP</code>, <code>H4L FMT</code> in their default LOW positions.',
    wiringPower:
      "<strong>Audio + power:</strong> 3.5 mm jack on the right edge carries L+R line-out (stereo per board). Two boards together draw ≈ 50 mA at 3V3 — comfortably inside the ESP32-S3 dev-board's 3V3 LDO budget. Star-tie GND at the DAC side to keep digital switching noise off the analog output.",
    asrcIntro:
      'The USB host clock and the ESP32 I2S clock are independent — over minutes they drift apart by tens of PPM, which would either over-fill the input ring buffer (clicks from drops) or starve it (clicks from underruns). ASRC re-samples the incoming USB stream by a fractional ratio so the output rate exactly tracks the I2S clock, and a PI controller nudges that ratio to keep the buffer at a target fill.',
    asrcBlockUsb: 'USB stream',
    asrcBlockUsbSub: 'drifts ±20–50 ppm',
    asrcBlockPi: 'PI controller',
    asrcBlockPiSub: 'monitors fill %',
    asrcBlockI2s: 'I2S stream',
    asrcBlockI2sSub: 'DAC clock-locked',
    asrcControlLaw: 'Control law',
    asrcControlLawText:
      'Each telemetry tick the controller computes the buffer error vs. target (50% fill by default):',
    asrcDefaults: 'Defaults: Kp = 0.3, Ki = 0.05, target = 50%, max ±200 ppm.',
    asrcTuning: 'Tuning',
    asrcTuning1:
      '<strong>Kp too low</strong> → buffer drifts away from target slowly, eventually glitches.',
    asrcTuning2: '<strong>Kp too high</strong> → audible warble as the controller hunts.',
    asrcTuning3:
      '<strong>Ki</strong> kills steady-state offset; raise gently if buffer parks at the wrong fill.',
    asrcTuning4:
      '<strong>maxPpm</strong> caps the worst-case correction — set just above your measured drift band.',
    asrcTuningTip:
      'Tune live in the System panel — drift + jitter charts show the loop converging.',
    swCore0List1: '<strong>tinyusb_task</strong> — UAC class driver on the native USB-OTG port',
    swCore0List2:
      '<strong>UART0 / USB-Serial-JTAG</strong> — separate USB-C port; carries the Web Serial control stream',
    swCore0List3:
      '<strong>serial_rx</strong> — frame parser, dispatches to <code>dsp_param_apply()</code>',
    swCore0List4: '<strong>app_main</strong> — NVS init, DSP boot, idle',
    swCore1List1: '<strong>audio_task</strong> — UAC ring buffer → ASRC → DSP → dual I2S',
    swCore1List2: 'Polls <code>dsp_param_poll_update()</code> between blocks',
    swCore1List3: 'Atomic config-pointer swap (lock-free)',
    swCore1List4: 'Highest priority, pinned',
    swParamFlow1: 'Edit in UI → diff middleware → Web Serial frame',
    swParamFlow2: '<code>serial_server</code> parses → <code>dsp_param_apply()</code>',
    swParamFlow3: 'Stage in shadow buffer, recalc biquad coeffs',
    swParamFlow4: 'Notify audio task → atomic swap on next block',
    swParamFlow5: '<strong>Apply</strong> button bulk-pushes everything at once',
    swParamFlow6: '<strong>Save to Device</strong> commits NVS (one-shot)',
    check1Test: 'Wire both PCM5102A boards (XSMT=3.3V, SCK=GND)',
    check1Exp: '5 wires + 2 jumpers per board',
    check2Test: 'Plug ESP32-S3 USB-C into Mac',
    check2Exp: 'macOS Audio MIDI Setup shows DQ-DSP as a 2-ch / 2-ch UAC device',
    check3Test: 'Play music with the device selected as output',
    check3Exp: 'Audio comes out both DAC boards (default routing: In 1 → DAC #1, In 2 → DAC #2)',
    check4Test: 'Open the web UI in Chrome → Connect Serial',
    check4Exp: 'Status dot turns green, "DQ-DSP" port name shown',
    check5Test: 'Edit master volume slider',
    check5Exp: 'Volume changes live (no Apply needed)',
    check6Test: 'Adjust an EQ band',
    check6Exp: 'Frequency response audibly changes; chart trace updates',
    check7Test: 'Click Apply',
    check7Exp: 'Bulk push to RAM; "Applied!" flash',
    check8Test: 'Click Save to Device',
    check8Exp: 'Config commits to NVS; survives unplug + replug',
    check9Test: 'Set crossover on Out 1: LP 200 Hz, Out 2: HP 200 Hz',
    check9Exp: 'Bi-amp split: Out 1 carries bass, Out 2 carries treble',
    check10Test: 'Open Console panel',
    check10Exp: 'CPU load + clock-drift charts populate at 1 Hz',
  },
  signalflow: {
    gainPeq: 'Gain/PEQ',
    routing2x4: 'Routing 2x4',
    matrix: 'Matrix',
    peqXoGainDelay: 'PEQ/XO/Gain/Delay',
    flowLabel: 'Signal Flow: ADC → Input Processing → Routing Matrix → Output Processing → DAC',
  },
  input: {
    link: 'Link In 1 ↔ 2',
    linkOn: 'In 1 ↔ 2 Linked',
    linkTitle:
      'Link mirrors gain, mute, phase, and PEQ between Input 1 and Input 2 in real time. Use for true stereo source where both channels need identical processing.',
    linkActive: 'Stereo link active — gain, mute, phase, and PEQ apply to both inputs',
    paramEq: 'Parametric EQ (10 bands)',
    channelIn: 'In',
  },
  output: {
    channelOut: 'Out',
    mirroring:
      'Mirroring with {{names}} — gain, mute, phase, delay, PEQ, and crossover stay in sync',
    paramEq: 'Parametric EQ (10 bands)',
  },
  drift: {
    title: 'Drift Compensation (ASRC)',
    resetTooltip:
      'Restore Kp, Ki, Target fill, and Max PPM to factory defaults — a safe starting point if tuning has gone unstable.',
    resetDefaults: 'Reset to defaults',
    intro:
      'The USB host and ESP32 I2S clocks run independently and drift apart over time. A PI controller monitors the ring buffer fill level and adjusts the ASRC resampling ratio to keep them in sync. When tuning is off, audio glitches (clicks/pops) appear after several minutes.',
    howToTune: 'How to tune',
    kp: 'Kp',
    ki: 'Ki',
    targetFill: 'Target fill',
    maxPpm: 'Max PPM',
    kpDesc:
      'Proportional gain. Reacts to how far the buffer fill is from the target right now. Higher = faster response but can overshoot and oscillate. Start low (0.1) and increase until the buffer stabilizes quickly.',
    kiDesc:
      "Integral gain. Corrects steady-state drift that Kp alone can't eliminate. Too high causes slow oscillation. Increase in small steps (0.01) until the buffer stays centered without wandering.",
    targetDesc:
      'The desired ring buffer fill level. 50% gives equal headroom for both directions of drift. Lower values reduce latency but leave less margin for USB bursts.',
    maxPpmDesc:
      'Clamps the maximum correction. PPM = parts per million: at 48 kHz, 100 PPM means the effective sample rate shifts by ~4.8 Hz. Typical USB/I2S drift is 20–50 PPM. Set it just high enough to cover your actual drift.',
    clicksTitle: 'If you hear clicks after 5–10 min',
    clicks1:
      'Try lowering Kp to 0.1 and Ki to 0.01 — aggressive gains can cause the ratio to jump, producing micro-glitches.',
    clicks2: 'Reduce Max PPM to 50–100 to limit correction magnitude.',
    clicks3:
      'If the buffer slowly drifts to 0% or 100% and then glitches, increase Ki slightly to improve steady-state tracking.',
    clicks4:
      'Watch the serial console for buffer fill % — it should hover near the target without large swings.',
    kpHint:
      'Proportional gain. Reacts to current buffer offset. Higher = faster response, risk of overshoot. Start at 0.1–0.3.',
    kiHint:
      "Integral gain. Eliminates steady-state drift Kp can't fix. Too high causes slow oscillation. 0.01–0.05 is typical.",
    targetHint:
      'Desired ring buffer fill. 50% gives equal headroom in both directions. Lower = less latency but tighter underrun margin.',
    maxPpmHint:
      'Clamp on the resampling correction. Typical USB↔I2S drift is 20–50 PPM; set just enough to cover yours.',
  },
  crossover: {
    title: 'Crossover',
    titleTooltip:
      'Per-output crossover stage — splits the band each driver should reproduce. HP keeps content above cutoff (tweeter/mid); LP keeps content below (sub/woofer). Combine HP+LP for a bandpass.',
    hp: 'HP',
    lp: 'LP',
    hpLong: 'High Pass',
    lpLong: 'Low Pass',
    hpDesc:
      'High Pass — attenuates content below the cutoff. Use for tweeters, mids, and protecting any driver from low-frequency excursion.',
    lpDesc:
      'Low Pass — attenuates content above the cutoff. Use for woofers and subwoofers to keep mids/highs out of bass drivers.',
    enable: 'Enable {{name}}',
    typeButterworth: 'Butterworth',
    typeLinkwitzRiley: 'Linkwitz-Riley',
  },
  routing: {
    title: 'Routing Matrix (2×4)',
    stereo: 'Stereo',
    mono: 'Mono',
    clear: 'Clear',
    routeLabel: 'Input {{input}} → Output {{output}}',
    routedTooltip:
      '{{route}} routed at {{pct}}%. Click the cell to mute this route; drag the slider for a partial mix (e.g. 50/50 mono blend).',
    disabledTooltip:
      '{{route}} disabled. Click to enable routing — input audio will mix into this output channel.',
    gainAria: '{{route}} gain',
  },
  roomEq: {
    title: 'Room EQ',
    linkLR: 'Link L/R',
    linkTooltip:
      'Mirror Room EQ band edits between Input 1 and Input 2 — useful when both speakers sit in similar room positions and need the same correction.',
    editInput:
      'Edit Room EQ for Input {{n}}. Each input has its own 10-band Room EQ stage applied before the per-output PEQ.',
    importRew: 'Import REW',
    clearTooltip: 'Discard the loaded measurement (does not change EQ band settings).',
    clear: 'Clear',
    smooth: 'Smooth',
    smoothingTooltip:
      'Apply 1/{{n}}-octave smoothing to the measurement. Coarser smoothing (1/3) hides narrow room nulls; finer (1/24) keeps detail. 1/6 is a common starting point.',
    target: 'Target',
    targetFlat:
      'Flat target — aim for ruler-flat in-room response. Best for analytical near-field listening.',
    targetHarman:
      'Harman curve — research-backed in-room target with gentle bass shelf and high-frequency tilt that listeners prefer in blind tests.',
    targetTilt:
      'Tilt target — straight-line slope (negative dB per octave) from low to high. Adjust the slope slider to taste.',
    tiltTooltip: 'Tilt slope {{slope}} dB/oct — drag to taste',
    tiltAria: 'Tilt target slope',
    autoEq: 'Auto EQ',
    bands: 'Bands',
    bandsAria: 'Number of EQ bands',
    bandsTooltip:
      'Maximum number of EQ bands to allocate. Fewer = smoother, more transparent; more = tighter fit but risk of over-correction.',
    cut: 'Cut',
    cutAria: 'Maximum cut in dB',
    cutTooltip:
      "Maximum allowed cut in dB. The auto-EQ never digs deeper than this — useful to keep room nulls (which can't be EQ'd out anyway) from monopolizing the bands.",
    boost: 'Boost',
    boostAria: 'Maximum boost in dB',
    boostTooltip:
      'Maximum allowed boost in dB. Boosting deep room nulls usually wastes headroom — keep this conservative (≤6 dB).',
    maxQ: 'Max Q',
    maxQAria: 'Maximum Q',
    maxQTooltip:
      'Maximum Q (filter narrowness). High Q can ring; 4–8 is a safe ceiling for room correction.',
    calculate: 'Calculate',
    calculateTooltip:
      'Run auto-EQ — compute up to N peaking bands that pull the smoothed measurement towards the target curve. Overwrites the current Room EQ bands.',
    dropTitle: 'Import a REW measurement file (.txt)',
    dropHint: 'or drag and drop here',
    bypassTooltip:
      'Bypass the Room EQ stage globally — A/B compare with-vs-without correction without losing the band settings.',
    on: 'Room EQ On',
    off: 'Room EQ Off',
    paramEqLabel: 'Parametric EQ — 10 bands',
    rewTitle: 'Import a REW measurement (.txt)',
    rewIntro:
      "Drop or pick a frequency-response file exported from Room EQ Wizard. We apply our own smoothing here in the UI, so export the raw response — don't pre-smooth in REW.",
    rewHowTo: 'How to export from REW',
    rewStep1: 'Take a measurement (sweep) in REW.',
    rewStep2: 'Open the SPL graph — leave smoothing at None.',
    rewStep3: 'File → Export → Export measurement as text.',
    rewStep4: 'Un-tick "Use REW measurement smoothing"; leave the delimiter as space/tab.',
    rewStep5: 'Save the .txt and drop it here — pick smoothing (1/3 – 1/24) in the toolbar.',
  },
  customSum: {
    title: 'Custom Sums',
    sum: 'Sum',
    add: 'Add',
    addTooltip:
      'Create a new acoustic-sum curve. Pick which outputs contribute, and the chart will plot their complex sum (handles phase + crossover overlap properly).',
    empty: 'No custom sums yet. Click',
    nameTooltip:
      'Display name shown on the response chart pill (e.g. ‘Left main’, ‘Sub mix’, ‘System’).',
    namePlaceholder: 'Sum name',
    colorTooltip: 'Use {{color}} as the chart trace colour for this sum',
    pickColor: 'Pick color {{color}}',
    deleteTooltip: 'Delete this sum',
    delete: 'Delete',
    outputs: 'Outputs',
    include: 'Include',
    remove: 'Remove',
    toggleOutput: '{{action}} Output {{n}} in this acoustic sum',
    includeOutput: 'Include Output {{n}}',
    footer:
      'Sums are computed as complex (acoustic) addition. Saved with each preset and in localStorage.',
    sumOf: '{{name}} = Σ {{outputs}}',
    emptyOutputs: '(empty)',
    manageTooltip:
      'Manage user-defined acoustic sum curves — pick a set of outputs and visualize their summed response (e.g. left tweeter + woofer to verify the crossover blend).',
  },
  filterType: {
    default: 'EQ band filter type',
    aria: 'EQ band filter type',
    labelPeaking: 'Peaking',
    labelLowShelf: 'Low Shelf',
    labelHighShelf: 'High Shelf',
    labelLowPass: 'Low Pass',
    labelHighPass: 'High Pass',
    labelBandPass: 'Band Pass',
    labelNotch: 'Notch',
    labelAllPass: 'All Pass',
    peaking:
      'Peaking EQ — boost or cut a band around the centre frequency. Most common for surgical fixes.',
    lowShelf:
      'Low Shelf — broad gain change for everything below the corner frequency. Use to add/remove warmth.',
    highShelf:
      'High Shelf — broad gain change for everything above the corner frequency. Use to add air or tame brightness.',
    lowPass: 'Low Pass — attenuate above the cutoff. Removes high-frequency content.',
    highPass: 'High Pass — attenuate below the cutoff. Removes rumble and DC offset.',
    bandPass:
      'Band Pass — keeps a band around the centre frequency, attenuating everything else. Use to isolate a range.',
    notch: 'Notch — narrow deep cut at the centre frequency. Use to kill resonances.',
    allPass:
      'All Pass — passes all frequencies but shifts the phase, rolling 360° across the spectrum. Use for phase alignment without amplitude change.',
  },
  controls: {
    delay: 'Delay',
    delayTooltip:
      "Output delay in milliseconds. Use to time-align drivers — e.g. delay the tweeter to match a deeper-cone woofer's acoustic centre. 1 ms ≈ 34 cm of distance.",
    delayAria: 'Delay in milliseconds (0 to {{max}})',
    gain: 'Gain',
    gainTooltip:
      '{{label}}: {{value}} (range {{min}} to {{max}} dB). Drag to adjust; bottom of range silences the channel.',
    mute: 'Mute channel',
    unmute: 'Unmute channel',
    muteTooltip: 'Mute this channel (silences audio)',
    unmuteTooltip: 'Channel muted — click to unmute',
    phaseInvert: 'Invert phase',
    phaseRestore: 'Disable phase invert',
    phaseInvertTooltip:
      'Invert phase by 180° — useful for fixing wiring polarity or aligning a sub with the mains',
    phaseRestoreTooltip: 'Phase inverted (180°) — click to restore normal polarity',
  },
  linkPicker: {
    linked: 'Linked',
    linkWith: 'Link with…',
    tooltip:
      'Link mirrors changes (gain, mute, phase, delay, PEQ, crossover) across selected {{channels}} in real time. Use for stereo pairs or grouping multiple amps to a single sub.',
    mirrorWith: 'Mirror with',
    tip: 'Tip: Link {{channel}} 1+2 for a stereo pair, or all four to gang multiple amps onto one sub channel.',
  },
  linkButton: {
    link: 'Link',
    linked: 'Linked',
    linkChannels: 'Link channels',
    unlinkChannels: 'Unlink channels',
  },
  copyPicker: {
    copy: 'Copy',
    copied: 'Copied',
    tooltip:
      "One-shot copy: snapshot the current {{channel}}'s settings (gain, mute, phase, delay, PEQ, crossover) onto a target channel. Unlike Link, the channels stay independent afterwards.",
    copyTo: 'Copy to',
    footer: "Replaces the target's settings with a snapshot of {{channel}} {{n}}.",
  },
  charts: {
    clockDrift: 'Clock Drift',
    cpuLoad: 'CPU Load',
    response: 'Response',
    measurement: 'Measurement',
    roomEq: 'Room EQ',
    predicted: 'Predicted',
    target: 'Target',
    show: 'Show',
    hide: 'Hide',
    toggleTrace:
      '{{action}} {{name}} response trace on the chart. Toggling here only affects the visualization, not the actual signal flow.',
  },
  eq: {
    bandTooltip:
      'Band {{n}} — click row to focus the draggable handle on the graph; toggle the checkbox to bypass without losing settings.',
    enableBand: 'Enable band {{n}}',
    bandFreq: 'Band {{n}} frequency',
    bandGain: 'Band {{n}} gain',
    bandQ: 'Band {{n}} Q',
  },
  banner: {
    headline: 'Serial control unavailable',
    message: 'Browser environment not detected.',
    supportedHeadline: 'Web Serial available',
    supportedMessage: 'Web Serial API is supported in this browser.',
    insecureHeadline: 'This page is loaded over HTTP — Web Serial needs HTTPS',
    insecureMessage:
      'Web Serial only runs on secure contexts (HTTPS or localhost). Reopen the page at {{url}} to enable the Connect button.',
    mobileHeadline: "Mobile browsers can't pair serial devices",
    mobileMessage:
      'Web Serial pairing requires a desktop machine. Open this page on a Mac, Windows, or Linux laptop to connect to the ESP32-S3.',
    firefoxHeadline: "Firefox doesn't support Web Serial",
    firefoxMessage:
      "Firefox hasn't implemented the Web Serial API. Reopen this page in Chrome, Edge, Brave, or Opera to talk to the device.",
    safariHeadline: "Safari doesn't support Web Serial",
    safariMessage:
      "Safari hasn't shipped the Web Serial API. Reopen this page in Chrome, Edge, Brave, or Opera to talk to the device.",
    otherHeadline: 'Serial control unavailable',
    otherMessage:
      "This browser doesn't expose the Web Serial API. Reopen the page in a Chromium-based desktop browser (Chrome, Edge, Brave, Opera).",
    messageSuffix:
      "You can still browse and tweak the UI — just can't push parameters to a connected device from here.",
    dismiss: 'Dismiss',
  },
}
