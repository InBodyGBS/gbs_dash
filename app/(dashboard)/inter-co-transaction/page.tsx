/**
 * Inter-company Transaction 페이지
 * 법인 간 내부거래 관리 및 검증
 */

'use client';

import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminMonthlyView } from '@/components/arap/AdminMonthlyView';
import { AdminEntityView } from '@/components/arap/AdminEntityView';
import { AdminReviewPage } from '@/components/arap/AdminReviewPage';
import { EntityMainPage } from '@/components/arap/EntityMainPage';
import { EntitySubmissionPage } from '@/components/arap/EntitySubmissionPage';
import { ArapLoginDialog } from '@/components/arap/ArapLoginDialog';
import { getArapEntities } from '@/lib/services/arapService';
import type { ArapEntity } from '@/lib/types/arap';

const SESSION_STORAGE_KEY = 'arap_session';

interface ArapSession {
  entityId: string;
  entityName: string;
  isAdmin: boolean;
  loginTime: number;
}

export default function InterCoTransactionPage() {
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [session, setSession] = useState<ArapSession | null>(() => {
    // sessionStorage는 브라우저에서만 접근 가능합니다.
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const sessionData: ArapSession = JSON.parse(stored);
      // 세션 타임아웃 체크 (30분)
      const now = Date.now();
      if (now - sessionData.loginTime < 30 * 60 * 1000) return sessionData;

      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    } catch {
      return null;
    }
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState('monthly');

  const loadEntities = async () => {
    try {
      const entitiesData = await getArapEntities();
      setEntities(entitiesData);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  };

  useEffect(() => {
    // setState는 Promise 콜백에서 실행되도록 해서
    // `react-hooks/set-state-in-effect` 규칙을 피합니다.
    getArapEntities()
      .then((entitiesData) => setEntities(entitiesData))
      .catch((error) => {
        console.error('Failed to load entities:', error);
      });
  }, []);

  const handleLogin = (entityId: string, isAdmin: boolean) => {
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return;

    const sessionData: ArapSession = {
      entityId,
      entityName: entity.entity_name,
      isAdmin,
      loginTime: Date.now(),
    };

    setSession(sessionData);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

    // 관리자는 monthly 탭, 일반 사용자는 main 탭으로 시작
    setActiveTab(isAdmin ? 'monthly' : 'main');
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleSaveSuccess = () => {
    // 제출 성공 후 엔티티 목록 새로고침
    loadEntities();
  };

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">Loading entities...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <ArapLoginDialog
        open={true}
        entities={entities}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="max-w-[1920px] mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inter-company Transaction</h1>
            <p className="text-gray-500 mt-2">
              법인 간 내부거래 관리 및 검증 - {session.entityName}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            {session.isAdmin && (
              <>
                <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                <TabsTrigger value="entity">Entity View</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
              </>
            )}
            <TabsTrigger value="main">Main</TabsTrigger>
            <TabsTrigger value="submission">Submission</TabsTrigger>
          </TabsList>

          {session.isAdmin && (
            <>
              <TabsContent value="monthly" className="space-y-4">
                <AdminMonthlyView
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                />
              </TabsContent>

              <TabsContent value="entity" className="space-y-4">
                <AdminEntityView
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onYearChange={setSelectedYear}
                  onMonthChange={setSelectedMonth}
                />
              </TabsContent>

              <TabsContent value="review" className="space-y-4">
                <AdminReviewPage
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onYearChange={setSelectedYear}
                  onMonthChange={setSelectedMonth}
                />
              </TabsContent>
            </>
          )}

          <TabsContent value="main" className="space-y-4">
            <EntityMainPage
              entityId={session.entityId}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onYearChange={setSelectedYear}
              onMonthChange={setSelectedMonth}
            />
          </TabsContent>

          <TabsContent value="submission" className="space-y-4">
            <EntitySubmissionPage
              entityId={session.entityId}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onSaveSuccess={handleSaveSuccess}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
