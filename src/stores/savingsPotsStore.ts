import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DeFiService, YieldProtocol } from '@/services/defiService';
import { AutoInvestService, AutoInvestConfig, GoalProjection } from '@/services/autoInvestService';

export interface SavingsPot {
  id: string;
  name: string;
  description?: string;
  targetAmount: number; // in USDC
  currentAmount: number; // in USDC
  icon: string;
  color: string;
  category: 'housing' | 'transport' | 'emergency' | 'vacation' | 'investment' | 'custom';
  isYieldEnabled: boolean;
  yieldStrategy?: 'aave' | 'compound' | 'celo' | 'coinbase';
  apy?: number; // Annual percentage yield
  createdAt: Date;
  targetDate?: Date;
  isArchived: boolean;
  
  // Auto-invest fields
  isAutoInvestEnabled: boolean;
  autoInvestAmount?: number; // Weekly/monthly amount
  autoInvestFrequency?: 'weekly' | 'monthly';
  monthlyContribution?: number; // For goal projections
  
  // Strict pot fields
  isStrict: boolean;
  strictDeadline?: Date; // Cannot withdraw before this date
  
  // Joint pot fields
  isJoint: boolean;
  collaborators?: string[]; // Array of user IDs or addresses
  invitedUsers?: string[]; // Array of invited user emails/addresses
}

export interface YieldStrategy {
  id: string;
  name: string;
  protocol: string;
  apy: number;
  risk: 'low' | 'medium' | 'high';
  minAmount: number;
  description: string;
  isActive: boolean;
}

export interface SavingsPotsState {
  // Pots data
  pots: SavingsPot[];
  
  // Available yield strategies
  yieldStrategies: YieldStrategy[];
  
  // Global auto-invest setting
  globalAutoInvestEnabled: boolean;
  
  // Loading states
  isLoading: boolean;
  isUpdatingPot: string | null; // pot ID being updated
  
  // Actions
  createPot: (pot: Omit<SavingsPot, 'id' | 'currentAmount' | 'createdAt' | 'isArchived' | 'isAutoInvestEnabled' | 'isStrict' | 'isJoint'>) => void;
  updatePot: (id: string, updates: Partial<SavingsPot>) => void;
  deletePot: (id: string) => void;
  archivePot: (id: string) => void;
  
  // Funding actions
  addFunds: (potId: string, amount: number) => Promise<void>;
  withdrawFunds: (potId: string, amount: number) => Promise<void>;
  
  // Yield actions
  enableYield: (potId: string, strategy: string) => Promise<void>;
  disableYield: (potId: string) => Promise<void>;
  updateYieldStrategies: () => Promise<void>;
  
  // Auto-invest actions
  enableAutoInvest: (potId: string, amount: number, frequency: 'weekly' | 'monthly', strategyId?: string) => Promise<void>;
  disableAutoInvest: (potId: string) => Promise<void>;
  getAutoInvestConfig: (potId: string) => AutoInvestConfig | undefined;
  
  // Global auto-invest actions
  setGlobalAutoInvest: (enabled: boolean) => void;
  
  // Strict pot actions
  canWithdrawFromPot: (potId: string) => boolean;
  inviteUserToPot: (potId: string, userEmail: string) => Promise<void>;
  acceptPotInvitation: (potId: string, userId: string) => Promise<void>;
  
  // Projection and simulation
  getGoalProjection: (potId: string) => GoalProjection | undefined;
  updateProjections: () => void;
  
  // Getters
  getPotById: (id: string) => SavingsPot | undefined;
  getActivePots: () => SavingsPot[];
  getTotalSavings: () => number;
  getTotalYieldEarned: () => number;
  getProgressPercentage: (potId: string) => number;
  getAutoInvestSummary: () => {
    totalInvested: number;
    totalYieldEarned: number;
    activePots: number;
    averageAPY: number;
  };
}

// Initialize default yield strategies from DeFi service
const initializeYieldStrategies = (): YieldStrategy[] => {
  try {
    const protocols = DeFiService.getAvailableProtocols();
    return protocols.map(protocol => ({
      id: protocol.id,
      name: protocol.name,
      protocol: protocol.protocol,
      apy: protocol.currentAPY,
      risk: protocol.riskLevel,
      minAmount: protocol.minimumAmount,
      description: protocol.description,
      isActive: protocol.isActive,
    }));
  } catch (error) {
    console.warn('[SavingsPotsStore] Failed to load DeFi protocols, using fallback');
    // Fallback strategies
    return [
      {
        id: 'coinbase-usdc',
        name: 'Coinbase USDC',
        protocol: 'Coinbase',
        apy: 4.7,
        risk: 'low',
        minAmount: 1,
        description: 'Secure USDC holding with Coinbase',
        isActive: true,
      },
      {
        id: 'aave-usdc-v3',
        name: 'Aave V3 USDC',
        protocol: 'Aave',
        apy: 4.5,
        risk: 'low',
        minAmount: 10,
        description: 'Decentralized lending on Aave protocol',
        isActive: true,
      },
    ];
  }
};

// Pot templates for quick creation
export const potTemplates = [
  {
    name: 'Emergency Fund',
    description: 'Build a 6-month emergency fund for financial security',
    targetAmount: 5000,
    icon: '🛡️',
    color: '#EF4444',
    category: 'emergency' as const,
    isYieldEnabled: true,
    yieldStrategy: 'coinbase' as const,
  },
  {
    name: 'House Down Payment',
    description: 'Save for your dream home down payment',
    targetAmount: 50000,
    icon: '🏠',
    color: '#10B981',
    category: 'housing' as const,
    isYieldEnabled: true,
    yieldStrategy: 'aave' as const,
  },
  {
    name: 'New Car',
    description: 'Save up for a reliable vehicle',
    targetAmount: 25000,
    icon: '🚗',
    color: '#3B82F6',
    category: 'transport' as const,
    isYieldEnabled: true,
    yieldStrategy: 'compound' as const,
  },
  {
    name: 'Dream Vacation',
    description: 'Plan that perfect getaway',
    targetAmount: 3000,
    icon: '✈️',
    color: '#F59E0B',
    category: 'vacation' as const,
    isYieldEnabled: true,
    yieldStrategy: 'coinbase' as const,
  },
  {
    name: 'Investment Fund',
    description: 'Build capital for future investments',
    targetAmount: 10000,
    icon: '📈',
    color: '#8B5CF6',
    category: 'investment' as const,
    isYieldEnabled: true,
    yieldStrategy: 'celo' as const,
  },
];

export const useSavingsPotsStore = create<SavingsPotsState>()(
  subscribeWithSelector((set, get) => ({
    pots: [],
    yieldStrategies: initializeYieldStrategies(),
    globalAutoInvestEnabled: false,
    isLoading: false,
    isUpdatingPot: null,

    createPot: (potData) => {
      const newPot: SavingsPot = {
        id: `pot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        currentAmount: 0,
        createdAt: new Date(),
        isArchived: false,
        isAutoInvestEnabled: false,
        isStrict: false,
        isJoint: false,
        ...potData,
      };

      set((state) => ({
        pots: [...state.pots, newPot],
      }));

      console.log('[SavingsPotsStore] Created new pot:', newPot.name);
    },

    updatePot: (id, updates) => {
      set((state) => ({
        pots: state.pots.map((pot) =>
          pot.id === id ? { ...pot, ...updates } : pot
        ),
      }));

      console.log('[SavingsPotsStore] Updated pot:', id);
    },

    deletePot: (id) => {
      set((state) => ({
        pots: state.pots.filter((pot) => pot.id !== id),
      }));

      console.log('[SavingsPotsStore] Deleted pot:', id);
    },

    archivePot: (id) => {
      get().updatePot(id, { isArchived: true });
      console.log('[SavingsPotsStore] Archived pot:', id);
    },

    addFunds: async (potId, amount) => {
      set({ isUpdatingPot: potId });

      try {
        // TODO: Implement actual USDC transfer logic
        // This would integrate with your wallet service to transfer USDC
        console.log(`[SavingsPotsStore] Adding $${amount} to pot ${potId}`);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        set((state) => ({
          pots: state.pots.map((pot) =>
            pot.id === potId
              ? { ...pot, currentAmount: pot.currentAmount + amount }
              : pot
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully added funds');
      } catch (error) {
        console.error('[SavingsPotsStore] Error adding funds:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    withdrawFunds: async (potId, amount) => {
      set({ isUpdatingPot: potId });

      try {
        const pot = get().getPotById(potId);
        if (!pot || pot.currentAmount < amount) {
          throw new Error('Insufficient funds in pot');
        }

        // Check if withdrawal is allowed for strict pots
        if (!get().canWithdrawFromPot(potId)) {
          const deadlineStr = pot.strictDeadline?.toLocaleDateString();
          throw new Error(`Cannot withdraw from strict pot until ${deadlineStr}`);
        }

        // TODO: Implement actual withdrawal logic
        console.log(`[SavingsPotsStore] Withdrawing $${amount} from pot ${potId}`);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        set((state) => ({
          pots: state.pots.map((pot) =>
            pot.id === potId
              ? { ...pot, currentAmount: pot.currentAmount - amount }
              : pot
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully withdrew funds');
      } catch (error) {
        console.error('[SavingsPotsStore] Error withdrawing funds:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    enableYield: async (potId, strategy) => {
      set({ isUpdatingPot: potId });

      try {
        const strategyData = get().yieldStrategies.find(s => s.id === strategy);
        const pot = get().getPotById(potId);
        
        if (!strategyData) {
          throw new Error('Invalid yield strategy');
        }
        
        if (!pot) {
          throw new Error('Pot not found');
        }

        console.log(`[SavingsPotsStore] Enabling yield for pot ${potId} with strategy ${strategy}`);

        // Check minimum amount requirement
        if (pot.currentAmount < strategyData.minAmount) {
          throw new Error(`Minimum amount for this strategy is $${strategyData.minAmount}`);
        }

        // Use DeFi service to stake tokens (mock implementation)
        const mockUserAddress = '0x1234...'; // In real app, get from wallet
        await DeFiService.stakeTokens(
          mockUserAddress,
          strategy,
          pot.currentAmount,
          'USDC'
        );

        set((state) => ({
          pots: state.pots.map((p) =>
            p.id === potId
              ? { 
                  ...p, 
                  isYieldEnabled: true,
                  yieldStrategy: strategy as any,
                  apy: strategyData.apy,
                }
              : p
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully enabled yield via DeFi protocol');
      } catch (error) {
        console.error('[SavingsPotsStore] Error enabling yield:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    disableYield: async (potId) => {
      set({ isUpdatingPot: potId });

      try {
        // TODO: Implement DeFi withdrawal logic
        console.log(`[SavingsPotsStore] Disabling yield for pot ${potId}`);

        // Simulate disabling yield
        await new Promise(resolve => setTimeout(resolve, 2000));

        set((state) => ({
          pots: state.pots.map((pot) =>
            pot.id === potId
              ? { 
                  ...pot, 
                  isYieldEnabled: false,
                  yieldStrategy: undefined,
                  apy: undefined,
                }
              : pot
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully disabled yield');
      } catch (error) {
        console.error('[SavingsPotsStore] Error disabling yield:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    updateYieldStrategies: async () => {
      try {
        console.log('[SavingsPotsStore] Updating yield strategies from DeFi protocols');
        
        // Get real-time data from DeFi protocols
        const protocols = DeFiService.getAvailableProtocols();
        
        const updatedStrategies = await Promise.all(
          protocols.map(async (protocol) => {
            try {
              const currentAPY = await DeFiService.getCurrentAPY(protocol.id);
              return {
                id: protocol.id,
                name: protocol.name,
                protocol: protocol.protocol,
                apy: currentAPY,
                risk: protocol.riskLevel,
                minAmount: protocol.minimumAmount,
                description: protocol.description,
                isActive: protocol.isActive,
              } as YieldStrategy;
            } catch (error) {
              console.error(`Error updating APY for ${protocol.id}:`, error);
              // Return existing strategy if update fails
              const existing = get().yieldStrategies.find(s => s.id === protocol.id);
              return existing || {
                id: protocol.id,
                name: protocol.name,
                protocol: protocol.protocol,
                apy: protocol.currentAPY,
                risk: protocol.riskLevel,
                minAmount: protocol.minimumAmount,
                description: protocol.description,
                isActive: protocol.isActive,
              } as YieldStrategy;
            }
          })
        );
        
        set({ yieldStrategies: updatedStrategies });
        console.log('[SavingsPotsStore] Updated yield strategies with real APY data');
      } catch (error) {
        console.error('[SavingsPotsStore] Error updating yield strategies:', error);
      }
    },

    // Auto-invest actions
    enableAutoInvest: async (potId, amount, frequency, strategyId) => {
      set({ isUpdatingPot: potId });

      try {
        const pot = get().getPotById(potId);
        if (!pot) {
          throw new Error('Pot not found');
        }

        console.log(`[SavingsPotsStore] Enabling auto-invest for pot ${potId}`);

        // Calculate time horizon for strategy recommendation
        const amountNeeded = Math.max(0, pot.targetAmount - pot.currentAmount);
        const monthlyAmount = frequency === 'weekly' ? amount * 4.33 : amount;
        const timeHorizonMonths = Math.ceil(amountNeeded / Math.max(monthlyAmount, 1));

        // Get AI recommendation if no strategy specified
        const finalStrategyId = strategyId || AutoInvestService.recommendStrategy(
          pot.currentAmount,
          pot.targetAmount,
          timeHorizonMonths,
          monthlyAmount
        ).id;

        // Enable auto-invest through service
        const config = AutoInvestService.enableAutoInvest(
          potId,
          finalStrategyId,
          amount,
          frequency,
          true, // source from wallet
          true  // reinvest yields
        );

        // Update pot in store
        set((state) => ({
          pots: state.pots.map((p) =>
            p.id === potId
              ? {
                  ...p,
                  isAutoInvestEnabled: true,
                  autoInvestAmount: amount,
                  autoInvestFrequency: frequency,
                  monthlyContribution: monthlyAmount,
                  apy: config.strategy.expectedAPY,
                }
              : p
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully enabled auto-invest');
      } catch (error) {
        console.error('[SavingsPotsStore] Error enabling auto-invest:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    disableAutoInvest: async (potId) => {
      set({ isUpdatingPot: potId });

      try {
        console.log(`[SavingsPotsStore] Disabling auto-invest for pot ${potId}`);

        // Disable through service
        AutoInvestService.disableAutoInvest(potId);

        // Update pot in store
        set((state) => ({
          pots: state.pots.map((p) =>
            p.id === potId
              ? {
                  ...p,
                  isAutoInvestEnabled: false,
                  autoInvestAmount: undefined,
                  autoInvestFrequency: undefined,
                  monthlyContribution: undefined,
                }
              : p
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully disabled auto-invest');
      } catch (error) {
        console.error('[SavingsPotsStore] Error disabling auto-invest:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    getAutoInvestConfig: (potId) => {
      return AutoInvestService.getConfig(potId);
    },

    // Projection and simulation actions
    getGoalProjection: (potId) => {
      return AutoInvestService.getProjection(potId);
    },

    updateProjections: () => {
      const pots = get().getActivePots();
      
      pots.forEach(pot => {
        const monthlyContribution = pot.monthlyContribution || 0;
        if (monthlyContribution > 0) {
          AutoInvestService.calculateGoalProjection(
            pot.id,
            pot.currentAmount,
            pot.targetAmount,
            monthlyContribution
          );
        }
      });

      console.log('[SavingsPotsStore] Updated goal projections for all pots');
    },

    getAutoInvestSummary: () => {
      return AutoInvestService.getPortfolioSummary();
    },

    getPotById: (id) => {
      return get().pots.find(pot => pot.id === id);
    },

    getActivePots: () => {
      return get().pots.filter(pot => !pot.isArchived);
    },

    getTotalSavings: () => {
      return get().pots.reduce((total, pot) => total + pot.currentAmount, 0);
    },

    getTotalYieldEarned: () => {
      // TODO: Calculate actual yield earned over time
      // For now, return a mock calculation
      return get().pots
        .filter(pot => pot.isYieldEnabled && pot.apy)
        .reduce((total, pot) => {
          const annualYield = (pot.currentAmount * (pot.apy! / 100));
          return total + (annualYield / 365) * 30; // 30 days worth
        }, 0);
    },

    getProgressPercentage: (potId) => {
      const pot = get().getPotById(potId);
      if (!pot) return 0;
      return Math.min((pot.currentAmount / pot.targetAmount) * 100, 100);
    },

    // Global auto-invest actions
    setGlobalAutoInvest: (enabled) => {
      set({ globalAutoInvestEnabled: enabled });
      console.log(`[SavingsPotsStore] Global auto-invest ${enabled ? 'enabled' : 'disabled'}`);
    },

    // Strict pot actions
    canWithdrawFromPot: (potId) => {
      const pot = get().getPotById(potId);
      if (!pot || !pot.isStrict || !pot.strictDeadline) return true;
      
      const now = new Date();
      return now >= pot.strictDeadline;
    },

    inviteUserToPot: async (potId, userEmail) => {
      set({ isUpdatingPot: potId });

      try {
        const pot = get().getPotById(potId);
        if (!pot) {
          throw new Error('Pot not found');
        }

        console.log(`[SavingsPotsStore] Inviting ${userEmail} to pot ${potId}`);

        // TODO: Implement actual invitation logic (email/notification service)
        await new Promise(resolve => setTimeout(resolve, 1000));

        set((state) => ({
          pots: state.pots.map((p) =>
            p.id === potId
              ? {
                  ...p,
                  invitedUsers: [...(p.invitedUsers || []), userEmail],
                }
              : p
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully sent pot invitation');
      } catch (error) {
        console.error('[SavingsPotsStore] Error inviting user:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },

    acceptPotInvitation: async (potId, userId) => {
      set({ isUpdatingPot: potId });

      try {
        console.log(`[SavingsPotsStore] User ${userId} accepting invitation to pot ${potId}`);

        // TODO: Implement actual acceptance logic
        await new Promise(resolve => setTimeout(resolve, 1000));

        set((state) => ({
          pots: state.pots.map((p) =>
            p.id === potId
              ? {
                  ...p,
                  collaborators: [...(p.collaborators || []), userId],
                  invitedUsers: (p.invitedUsers || []).filter(email => email !== userId),
                }
              : p
          ),
          isUpdatingPot: null,
        }));

        console.log('[SavingsPotsStore] Successfully accepted pot invitation');
      } catch (error) {
        console.error('[SavingsPotsStore] Error accepting invitation:', error);
        set({ isUpdatingPot: null });
        throw error;
      }
    },
  }))
);