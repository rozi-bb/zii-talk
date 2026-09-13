"""
Tag ekspresi suara di balasan Zii: [laughter], [excited], dst.

HD voice Azure (DragonHD) ngerti tag ini langsung di teks — nggak diucapin,
tapi ngubah nada atau nyelipin suara ketawa. LLM kadang ngarang tag sendiri
([giggles], [Laughs]) dan Azure diam-diam ngabaiin yang nggak dikenal, jadi
yang boleh lolos ke browser cuma yang ada di ALLOWED.

Teks yang masuk database dibersihin total: riwayat tes itu buat dibaca.
"""

from __future__ import annotations

import re

# Sengaja cuma yang ada panduan kapan dipakainya di CHAT_SYSTEM. Tag tanpa
# panduan cuma buka peluang nada salah — dites, DeepSeek pernah pakai [happy]
# buat "kucingku mati". Yang bikin kata-kata susah ditangkep pelajar
# (whispering, shouting) atau kedengeran nge-judge (sighing) juga nggak masuk.
ALLOWED: tuple[str, ...] = (
    "laughter",
    "sympathetic",
    "excited",
    "impressed",
    "encouraging",
)
_ALLOWED = frozenset(ALLOWED)

# Kurung siku yang lebih panjang dari ini nggak mungkin tag — anggap teks biasa.
_MAX = 32

# Semua yang bentuknya kayak tag, diizinin atau nggak.
_TAG = re.compile(r"\[\s*[A-Za-z][A-Za-z _-]{0,30}\s*\]")
# Ekor stream yang kepotong di tengah tag: "[laugh"
_OPEN = re.compile(r"\[\s*[A-Za-z _-]*")


def strip(text: str) -> str:
    """Buang semua tag, rapiin spasi yang ketinggalan."""
    out = _TAG.sub(" ", text)
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r" +([.,!?…])", r"\1", out)
    return out.strip()


class TagFilter:
    """Nyaring tag di stream token.

    Tag bisa kepotong di antara dua token ("[laugh" + "ter]"), jadi mulai
    dari "[" teksnya ditahan sampai "]" nongol. Yang diizinin diterusin utuh
    (huruf kecil), sisanya dibuang. Hasilnya: browser nggak pernah nerima
    tag setengah jadi.

    Maksimal satu tag per balasan — dijaga di sini, bukan cuma di prompt:
    DeepSeek kebukti suka nempelin tag ke hampir tiap kalimat.
    """

    def __init__(self) -> None:
        self._held = ""
        self._tagged = False

    def push(self, chunk: str) -> str:
        text = self._held + chunk
        self._held = ""
        out: list[str] = []
        while text:
            i = text.find("[")
            if i < 0:
                out.append(text)
                break
            out.append(text[:i])
            text = text[i:]
            j = text.find("]")
            if j < 0:
                if len(text) <= _MAX:
                    self._held = text  # tunggu token berikutnya
                    break
                out.append("[")  # kepanjangan buat tag: kurung biasa
                text = text[1:]
                continue
            inner = text[1:j]
            if "[" in inner or len(inner) > _MAX:
                out.append("[")  # "[[laughter]" -> kurung pertama bukan pembuka tag
                text = text[1:]
                continue
            name = inner.strip().lower()
            if name in _ALLOWED and not self._tagged:
                self._tagged = True
                out.append(f"[{name}]")
            text = text[j + 1 :]
        return "".join(out)

    def flush(self) -> str:
        """Sisa di akhir stream. "[..." yang nggak pernah ditutup = pecahan tag, buang."""
        held, self._held = self._held, ""
        return "" if _OPEN.fullmatch(held) else held
