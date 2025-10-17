import api, { getInMemoryToken } from './api';

// API para almacenamiento seguro en backend (UserStorage)
const userStorage = {
  async keys() {
    const token = getInMemoryToken();
    if (!token) {
      // Si no hay token en memoria, evitamos llamar al backend y devolvemos lista vacía
      if (console.debug) console.debug('userStorage.keys: no hay token en memoria, omitiendo petición');
      return [];
    }
    const res = await api.get('/userstorage/keys/');
    return res.data.keys;
  },
  async loadLS(key) {
    const token = getInMemoryToken();
    if (!token) {
      if (console.debug) console.debug(`userStorage.loadLS(${key}): no hay token en memoria, omitiendo petición`);
      return null;
    }
    const res = await api.get('/userstorage/load/', { params: { key } });
    return res.data.found ? res.data.value : null;
  },
  async saveLS(key, value) {
    const token = getInMemoryToken();
    if (!token) {
      if (console.debug) console.debug(`userStorage.saveLS(${key}): no hay token en memoria, omitiendo petición`);
      return false;
    }
    const res = await api.post('/userstorage/save/', { key, value });
    return res.data.success;
  },
  async removeLS(key) {
    const token = getInMemoryToken();
    if (!token) {
      if (console.debug) console.debug(`userStorage.removeLS(${key}): no hay token en memoria, omitiendo petición`);
      return false;
    }
    const res = await api.post('/userstorage/remove/', { key });
    return res.data.success;
  }
};

export default userStorage;
