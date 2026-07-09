"""
AgriMesh SMS payload: proof that the "can't compress a megabyte into an SMS"
problem is a non-problem, because we never send the image.

We send the DECISION (disease class + location), not the pixels.
Entropy of the decision ~= a couple of bytes. Fits one SMS with room to spare.

Run: python payload_demo.py
"""

# --- minimal geohash encoder (no dependency) ---
_B32 = "0123456789bcdefghjkmnpqrstuvwxyz"

def geohash(lat, lng, precision=7):
    lat_r, lng_r = (-90.0, 90.0), (-180.0, 180.0)
    bits, bit, ch, even = [], 0, 0, True
    while len(bits) < precision:
        if even:
            mid = (lng_r[0] + lng_r[1]) / 2
            if lng > mid: ch = (ch << 1) | 1; lng_r = (mid, lng_r[1])
            else:         ch = (ch << 1);     lng_r = (lng_r[0], mid)
        else:
            mid = (lat_r[0] + lat_r[1]) / 2
            if lat > mid: ch = (ch << 1) | 1; lat_r = (mid, lat_r[1])
            else:         ch = (ch << 1);     lat_r = (lat_r[0], mid)
        even = not even
        bit += 1
        if bit == 5:
            bits.append(_B32[ch]); bit, ch = 0, 0
    return "".join(bits)

# --- payload build / parse ---
def build(disease_code, lat, lng):
    # disease_code: 1-2 chars base36 (up to 1296 classes). geohash7 ~= 76 m.
    return f"D{disease_code} {geohash(lat, lng, 7)}"

def parse(payload):
    d, gh = payload.split(" ")
    return d[1:], gh

GSM7_SINGLE = 160  # chars in one GSM-7 SMS (140 bytes @ 7 bits)
UCS2_SINGLE = 70   # chars in one SMS if any non-Latin char (Hindi) -> 2 bytes/char

def segments(text, unicode_):
    per = UCS2_SINGLE if unicode_ else GSM7_SINGLE
    per_multi = 67 if unicode_ else 153  # UDH overhead when concatenated
    return 1 if len(text) <= per else -(-len(text) // per_multi)

if __name__ == "__main__":
    # inbound: farmer -> server
    p = build("0A", 28.6100, 77.2000)   # class 10 (base36 "0A"), Ramnagar
    code, gh = parse(p)
    assert code == "0A" and len(gh) == 7
    assert len(p) <= GSM7_SINGLE
    print(f"INBOUND payload : '{p}'  ({len(p)} chars, {len(p)} bytes GSM-7)")
    print(f"  parsed        : disease={code}  geohash={gh}")
    print(f"  SMS segments  : {segments(p, False)}   (sender phone# = free UID from 'From' header)")
    print()

    # outbound: the REAL byte trap -- Hindi reply is UCS-2, 70-char limit
    hindi = "पत्ती की सड़न (Late Blight) पहचानी गई। 15kg ताम्र फफूंदनाशक कृषि केंद्र बी पर उपलब्ध (4.2 km)।"
    codes = "R:0A C:B D:4.2"   # code-based reply, GSM-7
    print(f"OUTBOUND Hindi  : {len(hindi)} chars -> {segments(hindi, True)} SMS (UCS-2, costs {segments(hindi, True)}x)")
    print(f"OUTBOUND codes  : '{codes}' -> {segments(codes, False)} SMS (GSM-7)")
    assert segments(hindi, True) > 1        # Hindi prose overflows one SMS
    assert segments(codes, False) == 1      # code reply fits one
    print("\nOK: image never transmitted; decision fits 1 SMS; Hindi reply is the real cost trap.")
