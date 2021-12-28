from typing import Optional


class XAutoMLManager:
    instance: Optional['XAutoML'] = None

    @classmethod
    def open(cls, instance: 'XAutoML'):
        cls.instance = instance

    @classmethod
    def get_active(cls):
        return cls.instance


def gcx():
    return XAutoMLManager.get_active()
