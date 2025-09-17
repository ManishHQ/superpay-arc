import 'fast-text-encoding';
import { createClient } from '@dynamic-labs/client';
import { ReactNativeExtension } from '@dynamic-labs/react-native-extension';
import { SolanaExtension } from '@dynamic-labs/solana-extension';
import { WebExtension } from '@dynamic-labs/web-extension';

const environmentId =
	(process.env.EXPO_PUBLIC_ENVIRONMENT_ID as string) ||
	'eba2bd12-09b3-4c4d-ba16-4727c3c89a49';

if (!environmentId) {
	throw new Error('EXPO_PUBLIC_ENVIRONMENT_ID is required');
}

export const dynamicClient = createClient({
	environmentId,
	appLogoUrl: 'https://demo.dynamic.xyz/favicon-32x32.png',
	appName: 'Superpay',
})
	.extend(ReactNativeExtension())
	.extend(SolanaExtension())
	.extend(WebExtension());

// Solana connection will be handled via dynamicClient.solana.getConnection()

// Solana signer will be handled via dynamicClient.solana.getSigner()
