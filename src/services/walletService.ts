import { dynamicClient } from '@/lib/client';
import { Wallet } from '@dynamic-labs/client';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface WalletBalances {
	SOL: {
		raw: number;
		formatted: string;
	};
	usdc: {
		raw: number;
		formatted: string;
		decimals: number;
	};
	address: string;
	shortAddress: string;
}

export interface TransactionResult {
	hash: string;
	status: 'pending' | 'confirmed' | 'failed';
	slot?: number;
}

export class WalletService {
	private connection: Connection | null = null;

	constructor() {
		// Connection will be created when needed
	}

	private getConnection(): Connection {
		if (!this.connection) {
			this.connection = dynamicClient.solana.getConnection();
		}
		return this.connection;
	}

	/**
	 * Get the primary connected wallet
	 */
	getPrimaryWallet(): Wallet | null {
		return dynamicClient.wallets.primary || null;
	}

	/**
	 * Get all connected wallets
	 */
	getAllWallets(): Wallet[] {
		return dynamicClient.wallets.userWallets;
	}

	/**
	 * Check if any wallet is connected
	 */
	isWalletConnected(): boolean {
		return dynamicClient.wallets.primary !== null;
	}

	/**
	 * Get the primary wallet address
	 */
	getPrimaryWalletAddress(): string | null {
		const primaryWallet = this.getPrimaryWallet();
		return primaryWallet?.address || null;
	}

	/**
	 * Get all balances for a wallet address
	 */
	async getAllBalances(address: `0x${string}`): Promise<WalletBalances> {
		try {
			// Fetch SOL and USDC balances in parallel
			const [ethBalance, usdcBalance] = await Promise.all([
				this.getETHBalance(address),
				this.usdcService.getBalance(address),
			]);

			return {
				SOL: ethBalance,
				usdc: usdcBalance,
				address,
				shortAddress: this.formatAddress(address),
			};
		} catch (error) {
			console.error('Error fetching wallet balances:', error);
			throw new Error(`Failed to fetch wallet balances: ${error}`);
		}
	}

	/**
	 * Get SOL balance for an address
	 */
	private async getSOLBalance(address: string): Promise<{
		raw: number;
		formatted: string;
	}> {
		try {
			const connection = this.getConnection();
			const publicKey = new PublicKey(address);
			const balance = await connection.getBalance(publicKey);

			return {
				raw: balance,
				formatted: (balance / LAMPORTS_PER_SOL).toFixed(4),
			};
		} catch (error) {
			console.error('Error fetching SOL balance:', error);

			// Return zero balance instead of throwing to prevent UI crashes
			return {
				raw: 0,
				formatted: '0.0000',
			};
		}
	}

	/**
	 * Send a transaction using Dynamic Solana wallet
	 */
	async sendTransaction(
		to: string,
		value: number // lamports
	): Promise<TransactionResult> {
		try {
			const primaryWallet = this.getPrimaryWallet();
			if (!primaryWallet) {
				throw new Error('No wallet connected');
			}

			// Get Solana signer
			const signer = dynamicClient.solana.getSigner();
			const connection = this.getConnection();

			// Create simple transfer transaction
			const { Transaction, SystemProgram } = await import('@solana/web3.js');
			const transaction = new Transaction().add(
				SystemProgram.transfer({
					fromPubkey: new PublicKey(primaryWallet.address),
					toPubkey: new PublicKey(to),
					lamports: value,
				})
			);

			// Send transaction
			const signature = await signer.sendTransaction(transaction, connection);

			return {
				hash: signature,
				status: 'pending',
			};
		} catch (error) {
			console.error('Error sending Solana transaction:', error);
			throw new Error(`Failed to send transaction: ${error}`);
		}
	}

	/**
	 * Send SOL to an address
	 */
	async sendSOL(to: string, amount: string): Promise<TransactionResult> {
		const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;
		return this.sendTransaction(to, lamports);
	}

	/**
	 * Get transaction status
	 */
	async getTransactionStatus(signature: string): Promise<{
		status: 'pending' | 'confirmed' | 'failed';
		slot?: number;
		confirmations: number;
	}> {
		try {
			const connection = this.getConnection();
			const status = await connection.getSignatureStatus(signature);

			if (!status.value) {
				return { status: 'pending', confirmations: 0 };
			}

			const isConfirmed = status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized';
			const isFailed = status.value.err !== null;

			return {
				status: isFailed ? 'failed' : isConfirmed ? 'confirmed' : 'pending',
				slot: status.value.slot,
				confirmations: status.value.confirmations || 0,
			};
		} catch (error) {
			console.error('Error getting transaction status:', error);
			throw new Error(`Failed to get transaction status: ${error}`);
		}
	}

	/**
	 * Parse SOL amount from string to lamports
	 */
	private parseSOL(amount: string): number {
		const SOL = parseFloat(amount);
		if (isNaN(SOL) || SOL < 0) {
			throw new Error('Invalid SOL amount');
		}
		return Math.floor(SOL * LAMPORTS_PER_SOL);
	}

	/**
	 * Format SOL balance from lamports to SOL
	 */
	private formatSOLBalance(balance: number): string {
		const SOL = balance / LAMPORTS_PER_SOL;
		return SOL.toFixed(4);
	}

	/**
	 * Format wallet address to short version
	 */
	private formatAddress(address: string): string {
		if (!address || address.length < 10) return address;
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	// TODO: Implement USDC service for Solana
	// getUSDCService(): USDCService { ... }

	/**
	 * Validate if an address is a valid Solana address
	 */
	static isValidAddress(address: string): boolean {
		try {
			new PublicKey(address);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get default balance structure for when wallet is not connected
	 */
	static getDefaultBalances(): {
		usdcBalance: string;
		solBalance: string;
		walletAddress: string;
	} {
		return {
			usdcBalance: '0.00',
			solBalance: '0.0000',
			walletAddress: 'Not connected',
		};
	}

	/**
	 * Get wallet connection status
	 */
	static getConnectionStatus(): {
		isConnected: boolean;
		address: string | null;
		shortAddress: string | null;
	} {
		const primaryWallet = dynamicClient.wallets.primary;
		return {
			isConnected: primaryWallet !== null,
			address: primaryWallet?.address || null,
			shortAddress: primaryWallet?.address
				? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}`
				: null,
		};
	}

	/**
	 * Disconnect the current wallet
	 */
	static disconnectWallet(): void {
		dynamicClient.auth.logout();
	}

	/**
	 * Get wallet metadata
	 */
	static getWalletMetadata(): {
		name: string;
		icon: string;
		connector: string;
	} | null {
		const primaryWallet = dynamicClient.wallets.primary;
		if (!primaryWallet) return null;

		return {
			name: primaryWallet.connector.name,
			icon: primaryWallet.connector.icon,
			connector: primaryWallet.connector.id,
		};
	}
}
