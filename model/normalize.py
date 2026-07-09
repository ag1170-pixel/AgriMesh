"""
Collapse the 134 messy dataset folders into clean canonical classes.

The raw dataset mixes separators (_, __, ___), casing, crop-name repetition,
and spelling variants -> the SAME disease appears as several folders. Training
on that punishes the model for guessing the "wrong" duplicate label.

We DON'T copy 55k images. We emit class_map.csv (raw_folder -> canonical class
-> D-code). Training reads images via this map; SMS/backend read the codes.

Run: python model/normalize.py
"""
import os, csv, re

DATA = os.path.join(os.path.dirname(__file__), "..", "archive (1)", "dataset_clean_final")

# Semantic aliases the mechanical rules can't catch (spelling / word-splits).
CROP_ALIAS = {"gauva": "guava"}
COND_ALIAS = {
    "yellowleaf_curl_virus": "yellow_leaf_curl_virus",
    "tomato_yellowleaf_curl_virus": "yellow_leaf_curl_virus",
    "tomato_mosaic_virus": "mosaic_virus",
    "spider_mites_two_spotted_spider_mite": "spider_mites",
    "spider_mites": "spider_mites",
}

def canon(folder):
    s = folder.lower()
    s = re.sub(r"[()]", "", s)          # drop parens
    s = re.sub(r"_+", "_", s).strip("_")  # collapse _ runs
    parts = s.split("_")
    crop = CROP_ALIAS.get(parts[0], parts[0])
    cond = parts[1:]
    while cond and cond[0] in (crop, "tomato"):  # strip repeated crop prefix
        cond = cond[1:]
    cond = "_".join(cond) or "unknown"
    cond = COND_ALIAS.get(cond, cond)
    return crop, cond

def main():
    folders = sorted(d for d in os.listdir(DATA) if os.path.isdir(os.path.join(DATA, d)))
    groups = {}   # (crop,cond) -> [raw folders]
    counts = {}   # raw folder -> n images
    for f in folders:
        counts[f] = len(os.listdir(os.path.join(DATA, f)))
        groups.setdefault(canon(f), []).append(f)

    classes = sorted(groups)                       # deterministic order
    B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    code = lambda i: "D" + B36[i // 36] + B36[i % 36]

    with open(os.path.join(os.path.dirname(__file__), "class_map.csv"),
              "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["code", "canonical", "crop", "condition", "raw_folder", "n_images"])
        for i, key in enumerate(classes):
            crop, cond = key
            for raw in groups[key]:
                w.writerow([code(i), f"{crop}__{cond}", crop, cond, raw, counts[raw]])

    merged = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"raw folders : {len(folders)}")
    print(f"clean classes: {len(classes)}")
    print(f"merges       : {len(merged)} canonical classes absorbed duplicates\n")
    for key in sorted(merged):
        tot = sum(counts[r] for r in merged[key])
        print(f"  {key[0]}__{key[1]}  ({tot} imgs)  <=  {merged[key]}")

    # ponytail check: no class collides by code; every raw folder mapped once
    assert len(classes) <= 1296, "need >2 base36 digits"
    assert sum(len(v) for v in groups.values()) == len(folders)
    print("\nOK -> model/class_map.csv")

if __name__ == "__main__":
    main()
