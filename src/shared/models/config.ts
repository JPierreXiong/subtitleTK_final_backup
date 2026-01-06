import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';

import { publicSettingNames } from '../services/settings';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export async function saveConfigs(configs: Record<string, string>) {
  const result = await db().transaction(async (tx: any) => {
    const configEntries = Object.entries(configs);
    const results = [];

    for (const [name, configValue] of configEntries) {
      const [upsertResult] = await tx
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning();

      results.push(upsertResult);
    }

    return results;
  });

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();

  return result;
}

export async function getConfigs(): Promise<Configs> {
  const configs: Record<string, string> = {};

  if (!envConfigs.database_url) {
    return configs;
  }

  const result = await db().select().from(config);
  if (!result) {
    return configs;
  }

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return configs;
}

export async function getAllConfigs(): Promise<Configs> {
  let dbConfigs: Configs = {};

  // only get configs from db in server side
  if (envConfigs.database_url) {
    try {
      dbConfigs = await getConfigs();
    } catch (e) {
      console.log(`get configs from db failed:`, e);
      dbConfigs = {};
    }
  }

  // Read Creem and other payment provider configs from environment variables
  // Environment variables take precedence over database configs (for security and flexibility)
  const envPaymentConfigs: Configs = {};
  
  // Creem configuration from environment variables
  if (process.env.CREEM_ENABLED !== undefined) {
    envPaymentConfigs.creem_enabled = process.env.CREEM_ENABLED;
  }
  if (process.env.CREEM_ENVIRONMENT !== undefined) {
    envPaymentConfigs.creem_environment = process.env.CREEM_ENVIRONMENT;
  }
  if (process.env.CREEM_API_KEY !== undefined) {
    envPaymentConfigs.creem_api_key = process.env.CREEM_API_KEY;
  }
  if (process.env.CREEM_SIGNING_SECRET !== undefined) {
    envPaymentConfigs.creem_signing_secret = process.env.CREEM_SIGNING_SECRET;
  }
  if (process.env.CREEM_PRODUCT_IDS !== undefined) {
    envPaymentConfigs.creem_product_ids = process.env.CREEM_PRODUCT_IDS;
  }
  
  // Stripe configuration from environment variables
  if (process.env.STRIPE_ENABLED !== undefined) {
    envPaymentConfigs.stripe_enabled = process.env.STRIPE_ENABLED;
  }
  if (process.env.STRIPE_SECRET_KEY !== undefined) {
    envPaymentConfigs.stripe_secret_key = process.env.STRIPE_SECRET_KEY;
  }
  if (process.env.STRIPE_PUBLISHABLE_KEY !== undefined) {
    envPaymentConfigs.stripe_publishable_key = process.env.STRIPE_PUBLISHABLE_KEY;
  }
  if (process.env.STRIPE_SIGNING_SECRET !== undefined) {
    envPaymentConfigs.stripe_signing_secret = process.env.STRIPE_SIGNING_SECRET;
  }
  
  // PayPal configuration from environment variables
  if (process.env.PAYPAL_ENABLED !== undefined) {
    envPaymentConfigs.paypal_enabled = process.env.PAYPAL_ENABLED;
  }
  if (process.env.PAYPAL_CLIENT_ID !== undefined) {
    envPaymentConfigs.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
  }
  if (process.env.PAYPAL_CLIENT_SECRET !== undefined) {
    envPaymentConfigs.paypal_client_secret = process.env.PAYPAL_CLIENT_SECRET;
  }
  if (process.env.PAYPAL_ENVIRONMENT !== undefined) {
    envPaymentConfigs.paypal_environment = process.env.PAYPAL_ENVIRONMENT;
  }
  
  // Default payment provider from environment variables
  if (process.env.DEFAULT_PAYMENT_PROVIDER !== undefined) {
    envPaymentConfigs.default_payment_provider = process.env.DEFAULT_PAYMENT_PROVIDER;
  }
  if (process.env.SELECT_PAYMENT_ENABLED !== undefined) {
    envPaymentConfigs.select_payment_enabled = process.env.SELECT_PAYMENT_ENABLED;
  }

  const configs = {
    ...envConfigs,
    ...dbConfigs,
    ...envPaymentConfigs, // Environment variables override database configs
  };

  return configs;
}

export async function getPublicConfigs(): Promise<Configs> {
  let dbConfigs: Configs = {};

  // only get configs from db in server side
  if (typeof window === 'undefined' && envConfigs.database_url) {
    try {
      dbConfigs = await getConfigs();
    } catch (e) {
      console.log('get configs from db failed:', e);
      dbConfigs = {};
    }
  }

  const publicConfigs: Record<string, string> = {};

  // get public configs from db
  for (const key in dbConfigs) {
    if (publicSettingNames.includes(key)) {
      publicConfigs[key] = dbConfigs[key];
    }
  }

  // Also include public configs from environment variables
  // Environment variables take precedence over database configs
  if (process.env.CREEM_ENABLED !== undefined && publicSettingNames.includes('creem_enabled')) {
    publicConfigs.creem_enabled = process.env.CREEM_ENABLED;
  }
  if (process.env.DEFAULT_PAYMENT_PROVIDER !== undefined && publicSettingNames.includes('default_payment_provider')) {
    publicConfigs.default_payment_provider = process.env.DEFAULT_PAYMENT_PROVIDER;
  }
  if (process.env.SELECT_PAYMENT_ENABLED !== undefined && publicSettingNames.includes('select_payment_enabled')) {
    publicConfigs.select_payment_enabled = process.env.SELECT_PAYMENT_ENABLED;
  }
  if (process.env.STRIPE_ENABLED !== undefined && publicSettingNames.includes('stripe_enabled')) {
    publicConfigs.stripe_enabled = process.env.STRIPE_ENABLED;
  }
  if (process.env.PAYPAL_ENABLED !== undefined && publicSettingNames.includes('paypal_enabled')) {
    publicConfigs.paypal_enabled = process.env.PAYPAL_ENABLED;
  }

  const configs = {
    ...publicConfigs,
  };

  return configs;
}
