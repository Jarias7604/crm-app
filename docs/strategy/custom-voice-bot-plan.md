# 🎙️ Custom Voice Bot — Sofia con tu propia voz
## Stack: Telnyx + Deepgram + GPT-4o-mini + Cartesia

### Arquitectura
```
Lead → Telnyx (call) → WebSocket → Edge Function
                                        ↓
                              Deepgram (STT - escucha)
                                        ↓
                              GPT-4o-mini (piensa)
                                        ↓
                              Cartesia (TTS - tu voz)
                                        ↓
                         Telnyx WebSocket → Lead escucha
```

### Costo por llamada (3 min)
- Telnyx: $0.015
- Deepgram: $0.013  
- GPT-4o-mini: $0.024
- Cartesia: $0.045
- Total: ~$0.097

### APIs necesarias
- TELNYX_API_KEY
- TELNYX_PHONE_NUMBER
- DEEPGRAM_API_KEY
- CARTESIA_API_KEY
- CARTESIA_VOICE_ID (después de clonar)
- OPENAI_API_KEY (ya existe)
