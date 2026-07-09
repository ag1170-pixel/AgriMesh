"""
AgriMesh classifier — MobileNetV2 transfer learning on the 107 canonical classes.

Run on Google Colab (GPU runtime). Local machine has no GPU / TF, by design:
training the browser model is a one-time offline job, not part of the app.

Colab steps:
  1. Upload dataset_clean_final/ and model/class_map.csv
  2. pip install tensorflow tensorflowjs
  3. python train.py
  -> outputs web_model/  (model.json + *.bin)  ~4MB, drop into frontend/public/models/

Optimizations that matter here (not ceremony):
  - reads images via class_map.csv so the 27 duplicate folders map to ONE label
  - tf.data cache+prefetch, mixed precision -> GPU-bound, not IO-bound
  - class weights so 22-image classes aren't ignored vs 1500-image ones
  - 2-phase: frozen head, then fine-tune top layers
"""
import os, csv, json, collections
import tensorflow as tf

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "archive (1)", "dataset_clean_final")
IMG, BATCH, SEED = 224, 32, 42

# ---- build (path, label_index) list from the clean map ----
rows = list(csv.DictReader(open(os.path.join(HERE, "class_map.csv"), encoding="utf-8")))
codes = sorted({r["code"] for r in rows})
code_to_idx = {c: i for i, c in enumerate(codes)}
NUM = len(codes)

paths, labels = [], []
for r in rows:
    folder = os.path.join(DATA, r["raw_folder"])
    idx = code_to_idx[r["code"]]
    for fn in os.listdir(folder):
        paths.append(os.path.join(folder, fn)); labels.append(idx)
print(f"{len(paths)} images -> {NUM} classes")

# class weights for imbalance (22 vs 1500 images per class)
freq = collections.Counter(labels)
total = len(labels)
class_weight = {i: total / (NUM * freq[i]) for i in range(NUM)}

# ---- tf.data pipeline ----
def decode(path, label):
    img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
    img = tf.image.resize(img, [IMG, IMG])
    return img, label

ds = tf.data.Dataset.from_tensor_slices((paths, labels)).shuffle(len(paths), seed=SEED)
val_n = int(0.15 * len(paths))
aug = tf.keras.Sequential([tf.keras.layers.RandomFlip("horizontal"),
                           tf.keras.layers.RandomRotation(0.1),
                           tf.keras.layers.RandomZoom(0.1)])

def prep(d, training):
    d = d.map(decode, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        d = d.map(lambda x, y: (aug(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    return d.batch(BATCH).prefetch(tf.data.AUTOTUNE)

val_ds = prep(ds.take(val_n), False)
train_ds = prep(ds.skip(val_n), True)

# ---- model: MobileNetV2 base + head. preprocess baked in so the browser
#      only has to feed raw 0-255 pixels (no ImageNet-stats bug possible) ----
tf.keras.mixed_precision.set_global_policy("mixed_float16")
base = tf.keras.applications.MobileNetV2(input_shape=(IMG, IMG, 3), include_top=False, weights="imagenet")
base.trainable = False
inp = tf.keras.Input((IMG, IMG, 3))
x = tf.keras.applications.mobilenet_v2.preprocess_input(inp)
x = base(x, training=False)
x = tf.keras.layers.GlobalAveragePooling2D()(x)
x = tf.keras.layers.Dropout(0.3)(x)
out = tf.keras.layers.Dense(NUM, activation="softmax", dtype="float32")(x)
model = tf.keras.Model(inp, out)

cb = [tf.keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True),
      tf.keras.callbacks.ReduceLROnPlateau(patience=2, factor=0.3)]

# phase 1: train head
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(train_ds, validation_data=val_ds, epochs=15, class_weight=class_weight, callbacks=cb)

# phase 2: fine-tune top of base
base.trainable = True
for l in base.layers[:-30]:
    l.trainable = False
model.compile(optimizer=tf.keras.optimizers.Adam(1e-5),
              loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(train_ds, validation_data=val_ds, epochs=10, class_weight=class_weight, callbacks=cb)

# ---- export ----
model.save(os.path.join(HERE, "saved_model.keras"))
json.dump(codes, open(os.path.join(HERE, "model_codes.json"), "w"))  # index -> D-code
print("done. convert to web:  tensorflowjs_converter --input_format keras "
      "model/saved_model.keras frontend/public/models/")
