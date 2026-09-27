import { createContext, useContext } from 'react';
import type { AdminRole } from '../api/admin';

export const AdminRoleContext = createContext<AdminRole>('support');
export const useAdminRole = () => useContext(AdminRoleContext);
