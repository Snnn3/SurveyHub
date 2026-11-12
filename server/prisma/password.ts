import bcrypt from 'bcryptjs';

export async function hashSeedPassword(password: string): Promise<string> {
  // bcryptjs 2.x emits 2a; the ASCII seed password must use the contract's 2b prefix.
  return (await bcrypt.hash(password, 10)).replace(/^\$2a\$/, '$2b$');
}
