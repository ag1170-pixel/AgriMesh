# Drop the trained model here

After `model/train.py` runs on Colab and you convert it:

```
tensorflowjs_converter --input_format keras model/saved_model.keras frontend/public/models/
```

Copy the output into this folder so it contains:

```
frontend/models/
  labels.json      <- already here (model output index -> disease + D-code)
  model.json       <- from converter
  group1-shard*.bin
```

The frontend auto-detects `model.json`. Until it's here, the app runs a
deterministic **demo classifier** so the full pipeline is clickable. No code
change needed to go live — just drop the files in.
