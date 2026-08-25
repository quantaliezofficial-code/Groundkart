from app.modules.storage.base import FileStorage, LocalFileStorage

_storage: FileStorage = LocalFileStorage()


def get_file_storage() -> FileStorage:
    return _storage
