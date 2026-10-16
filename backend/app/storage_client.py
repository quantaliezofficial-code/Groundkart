from app.modules.storage.base import FileStorage, get_storage, get_private_storage

_storage: FileStorage = get_storage()
_private_storage: FileStorage = get_private_storage()


def get_file_storage() -> FileStorage:
    return _storage


def get_private_file_storage() -> FileStorage:
    return _private_storage

