/**
 * ARAP 로그인 다이얼로그
 * Entity 선택 및 비밀번호 입력
 */

'use client';

import { useState } from 'react';
import { Building2, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ArapEntity } from '@/lib/types/arap';

interface ArapLoginDialogProps {
  open: boolean;
  entities: ArapEntity[];
  onLogin: (entityId: string, isAdmin: boolean) => void;
}

const COMMON_PASSWORD = '0000';

export function ArapLoginDialog({ open, entities, onLogin }: ArapLoginDialogProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const isAdmin = selectedEntity?.is_admin || false;

  const handleEntityChange = (entityId: string) => {
    setSelectedEntityId(entityId);
    setPassword('');
    setError('');
  };

  const handleLogin = () => {
    if (!selectedEntityId) {
      setError('Please select an entity');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (password !== COMMON_PASSWORD) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setError('Too many failed attempts. Please try again later.');
        setTimeout(() => {
          setAttempts(0);
          setPassword('');
        }, 5000);
      } else {
        setError('Please enter your password');
      }
      return;
    }

    // 로그인 성공
    setError('');
    setAttempts(0);
    setPassword('');
    onLogin(selectedEntityId, isAdmin);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Intercompany AR-AP System
          </DialogTitle>
          <DialogDescription>
            Select your entity and enter password to access the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="entity">Select Entity</Label>
            <Select value={selectedEntityId} onValueChange={handleEntityChange}>
              <SelectTrigger id="entity">
                <SelectValue placeholder="Select an entity..." />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.entity_name}
                    {entity.is_admin && ' (Admin)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEntityId && (
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="Enter password"
                className={error ? 'border-red-500' : ''}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleLogin}
            className="w-full"
            disabled={!selectedEntityId || !password}
          >
            Login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
