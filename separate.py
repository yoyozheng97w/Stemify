import os
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model

model = get_model("htdemucs_ft")
model.eval()

wav, sr = torchaudio.load("test.wav")
wav = wav.unsqueeze(0)

with torch.no_grad():
    sources = apply_model(model, wav)

output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

stems = ["drums", "bass", "other", "vocals"]
for i, name in enumerate(stems):
    output_path = os.path.join(output_dir, f"{name}.wav")
    torchaudio.save(output_path, sources[0][i], sr)
    print(f"已輸出: {output_path}")