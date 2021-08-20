import re


def internal_cid_name(cid: str) -> str:
    return re.sub(r'0(\d)', r'\1', cid)
