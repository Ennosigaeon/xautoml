import asyncio
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Manager


class AsyncProcessQueue:
    def __init__(self, maxsize: int = 0):
        m = Manager()
        self._queue = m.Queue(maxsize=maxsize)
        self._executor = ThreadPoolExecutor(max_workers=1)

    def __getstate__(self):
        self_dict = self.__dict__
        self_dict['_real_executor'] = None
        return self_dict

    def __getattr__(self, name):
        if name in ['qsize', 'empty', 'full', 'put', 'put_nowait',
                    'get', 'get_nowait', 'close']:
            return getattr(self._queue, name)
        else:
            raise AttributeError("'%s' object has no attribute '%s'" %
                                 (self.__class__.__name__, name))

    async def coro_put(self, item):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.put, item)

    async def coro_get(self):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.get)
