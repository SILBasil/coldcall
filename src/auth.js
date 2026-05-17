export const VALID_USERS = [
  { id: 'a1', username: 'admin1', password: 'password123', role: 'admin', name: 'แอดมิน 1' },
  { id: 'a2', username: 'admin2', password: 'password123', role: 'admin', name: 'แอดมิน 2' },
  { id: 'a3', username: 'admin3', password: 'password123', role: 'admin', name: 'แอดมิน 3' },
  { id: 'm1', username: 'manager', password: 'password123', role: 'manager', name: 'ผู้จัดการ' },
];

export const login = (username, password) => {
  const user = VALID_USERS.find(
    (u) => u.username === username.toLowerCase() && u.password === password
  );
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  }
  
  return { success: false, message: 'Invalid username or password' };
};
