'use client';

import { useState } from 'react';
import { signInWithEmail } from '@/lib/auth';

export function LoginButton() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmail(email, password);
      alert('로그인 성공!');
      window.location.reload();
    } catch (error) {
      alert('로그인 실패');
    }
  };

  return (
    <div className="flex gap-2">
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border px-2 py-1"
      />
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border px-2 py-1"
      />
      <button 
        onClick={handleLogin}
        className="text-white px-4 py-1 rounded"
        style={{ backgroundColor: '#971B2F' }}
      >
        로그인
      </button>
    </div>
  );
}
