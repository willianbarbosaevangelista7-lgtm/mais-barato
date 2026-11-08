#!/usr/bin/env node
/**
 * End-to-end Supabase Storage regression test for MaisBarato.
 *
 * Uses a dedicated market-editor account and a service-role key only to seed
 * and clean isolated fixtures. Never point this at production.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_STORAGE_TEST_URL',
  'SUPABASE_STORAGE_TEST_ANON_KEY',
  'SUPABASE_STORAGE_TEST_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_TEST_EDITOR_EMAIL',
  'SUPABASE_STORAGE_TEST_EDITOR_PASSWORD',
  'SUPABASE_STORAGE_TEST_MARKET_ID',
  'SUPABASE_STORAGE_TEST_CUSTOMER_EMAIL',
  'SUPABASE_STORAGE_TEST_CUSTOMER_PASSWORD',
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const parsedUrl = new URL(process.env.SUPABASE_STORAGE_TEST_URL);
const url = parsedUrl.origin.replace(/\/+$/, '');
const hostname = parsedUrl.hostname.toLowerCase();
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
if (!isLocal && parsedUrl.protocol !== 'https:') {
  throw new Error('Remote Storage tests require HTTPS.');
}
if (!isLocal && process.env.SUPABASE_STORAGE_TEST_TARGET !== 'staging') {
  throw new Error(
    'Refusing to mutate a remote Supabase project. Set SUPABASE_STORAGE_TEST_TARGET=staging only for a disposable staging project.',
  );
}
if (!isLocal) {
  const expectedHost = process.env.SUPABASE_STORAGE_TEST_EXPECTED_HOST?.trim().toLowerCase();
  if (!expectedHost) {
    throw new Error('Set SUPABASE_STORAGE_TEST_EXPECTED_HOST to the exact staging hostname (without protocol or path).');
  }
  if (hostname !== expectedHost) {
    throw new Error(`Refusing to run: URL host "${hostname}" does not match expected staging host "${expectedHost}".`);
  }
}
if (process.env.SUPABASE_STORAGE_TEST_CONFIRM !== 'I_UNDERSTAND_THIS_CREATES_AND_DELETES_TEST_DATA') {
  throw new Error('Set SUPABASE_STORAGE_TEST_CONFIRM to the exact confirmation string before running.');
}

const bucket = 'product-images';
const marketId = process.env.SUPABASE_STORAGE_TEST_MARKET_ID;
const admin = createClient(url, process.env.SUPABASE_STORAGE_TEST_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, process.env.SUPABASE_STORAGE_TEST_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const editor = createClient(url, process.env.SUPABASE_STORAGE_TEST_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const customer = createClient(url, process.env.SUPABASE_STORAGE_TEST_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = randomUUID().replaceAll('-', '');
const productIds = ['approved', 'pending', 'rejected'].map((state) => `stg-${runId}-${state}`);
const fixtureTimestamp = Date.now();
const paths = productIds.map((id, index) => `${id}/${fixtureTimestamp + index}.jpg`);
const orphanPath = `stg-${runId}-orphan/${fixtureTimestamp + productIds.length}.jpg`;
const mutablePath = `${productIds[0]}/${fixtureTimestamp + productIds.length + 1}.jpg`;
// Valid 2x2 JPEG fixture. The production repository compresses/stores product photos as image/jpeg.
const imageBytes = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCsAJ9Iz//Z',
  'base64',
);
let checks = 0;
function check(condition, message) {
  checks += 1;
  assert.ok(condition, message);
  console.log(`PASS ${checks}: ${message}`);
}
async function mustSucceed(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}
async function signIn(client, email, password, label) {
  const data = await mustSucceed(label, client.auth.signInWithPassword({ email, password }));
  check(Boolean(data.session?.access_token), `${label} autentica`);
  return data.user;
}
async function signedDownload(client, path, label) {
  const data = await mustSucceed(label, client.storage.from(bucket).createSignedUrl(path, 90));
  check(Boolean(data.signedUrl), `${label}: URL assinada criada`);
  const response = await fetch(data.signedUrl);
  check(response.ok, `${label}: URL assinada baixa o arquivo (HTTP ${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  check(body.equals(imageBytes), `${label}: conteúdo baixado corresponde ao upload`);
}
async function mustBeDenied(label, operation) {
  let denied = false;
  try {
    const { error, data } = await operation();
    denied = Boolean(error) || !data;
  } catch {
    denied = true;
  }
  check(denied, label);
}

let editorUser;
let customerUser;
try {
  const bucketInfo = await mustSucceed('Ler configuração do bucket', admin.storage.getBucket(bucket));
  check(bucketInfo.public === false, 'bucket product-images está privado');

  editorUser = await signIn(
    editor,
    process.env.SUPABASE_STORAGE_TEST_EDITOR_EMAIL,
    process.env.SUPABASE_STORAGE_TEST_EDITOR_PASSWORD,
    'Conta de parceiro/editor',
  );
  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', editorUser.id);
  if (roleError) throw roleError;
  check(roleRows.some((row) => row.role === 'market'), 'conta de teste possui papel market');

  const { data: memberships, error: membershipError } = await admin
    .from('market_members')
    .select('market_id')
    .eq('user_id', editorUser.id)
    .eq('market_id', marketId);
  if (membershipError) throw membershipError;
  check(memberships.length > 0, 'parceiro pertence ao mercado de staging configurado');

  if (customer) {
    customerUser = await signIn(
      customer,
      process.env.SUPABASE_STORAGE_TEST_CUSTOMER_EMAIL,
      process.env.SUPABASE_STORAGE_TEST_CUSTOMER_PASSWORD,
      'Conta de cliente',
    );
    const { data: customerRoles, error } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', customerUser.id);
    if (error) throw error;
    check(customerRoles.some((row) => row.role === 'customer'), 'segunda conta possui papel customer');
    check(!customerRoles.some((row) => row.role === 'admin' || row.role === 'market'), 'cliente não possui papel privilegiado');
    const { data: customerMemberships, error: customerMembershipError } = await admin
      .from('market_members')
      .select('market_id')
      .eq('user_id', customerUser.id);
    if (customerMembershipError) throw customerMembershipError;
    check(customerMemberships.length === 0, 'cliente não possui vínculo com mercados');
  }

  const { error: productError } = await admin.from('products').insert(
    productIds.map((id, index) => ({
      id,
      name: `Storage test ${runId} ${index}`,
      brand: 'MaisBarato Test',
      category: 'Teste',
      size: 1,
      unit: 'un',
      emoji: '🧪',
      group_key: `storage-test-${runId}`,
      status: ['approved', 'pending', 'rejected'][index],
      image_path: null,
    })),
  );
  if (productError) throw new Error(`Criar produtos fixture: ${productError.message}`);

  const { error: priceError } = await admin.from('prices').insert(
    productIds.map((product_id) => ({
      product_id,
      market_id: marketId,
      price: 1,
      updated_at: new Date().toISOString().slice(0, 10),
    })),
  );
  if (priceError) throw new Error(`Vincular produtos ao mercado: ${priceError.message}`);

  for (let index = 0; index < paths.length; index += 1) {
    await mustSucceed(
      `Upload ${productIds[index]}`,
      editor.storage.from(bucket).upload(paths[index], imageBytes, {
        contentType: 'image/jpeg',
        upsert: false,
      }),
    );
    check(true, `editor consegue enviar imagem de produto ${['aprovado', 'pendente', 'rejeitado'][index]}`);
  }

  const { error: pathError } = await admin
    .from('products')
    .update({ image_path: paths[0] })
    .eq('id', productIds[0]);
  if (pathError) throw new Error(`Associar imagem aprovada: ${pathError.message}`);
  for (let index = 1; index < paths.length; index += 1) {
    const { error } = await admin.from('products').update({ image_path: paths[index] }).eq('id', productIds[index]);
    if (error) throw new Error(`Associar imagem fixture: ${error.message}`);
  }

  // New, unlinked objects can be previewed only by their uploader.
  await mustSucceed(
    'Upload imagem órfã para pré-visualização',
    editor.storage.from(bucket).upload(orphanPath, imageBytes, { contentType: 'image/jpeg', upsert: false }),
  );
  await signedDownload(editor, orphanPath, 'Uploader: prévia da própria imagem órfã');
  await mustBeDenied(
    'Visitante não consegue gerar URL assinada para imagem órfã',
    () => anon.storage.from(bucket).createSignedUrl(orphanPath, 90),
  );
  if (customer) {
    await mustBeDenied(
      'Outro usuário não consegue gerar URL assinada para imagem órfã',
      () => customer.storage.from(bucket).createSignedUrl(orphanPath, 90),
    );
  }

  // Nested object paths are outside the canonical product-id/timestamp.jpg shape.
  await mustBeDenied(
    'Editor não consegue enviar caminho aninhado',
    () => editor.storage.from(bucket).upload(
      `${productIds[0]}/nested/${Date.now()}.jpg`, imageBytes, { contentType: 'image/jpeg', upsert: false },
    ),
  );

  // Anonymous public access: only approved image can be signed and downloaded.
  await signedDownload(anon, paths[0], 'Visitante: imagem aprovada');
  for (const index of [1, 2]) {
    await mustBeDenied(
      `Visitante não consegue gerar URL assinada para imagem ${index === 1 ? 'pendente' : 'rejeitada'}`,
      () => anon.storage.from(bucket).createSignedUrl(paths[index], 90),
    );
  }

  // Direct public URLs must not bypass Storage RLS for any moderation state.
  for (let index = 0; index < paths.length; index += 1) {
    const { data } = anon.storage.from(bucket).getPublicUrl(paths[index]);
    const response = await fetch(data.publicUrl);
    check(!response.ok, `URL pública direta não expõe imagem ${['aprovada', 'pendente', 'rejeitada'][index]} (HTTP ${response.status})`);
  }

  // Authorized editor/uploader can still load all moderation states.
  for (let index = 0; index < paths.length; index += 1) {
    await signedDownload(editor, paths[index], `Editor/uploader: imagem ${['aprovada', 'pendente', 'rejeitada'][index]}`);
  }

  if (customer) {
    await signedDownload(customer, paths[0], 'Cliente: imagem aprovada');
    for (const index of [1, 2]) {
      await mustBeDenied(
        `Cliente não consegue gerar URL assinada para imagem ${index === 1 ? 'pendente' : 'rejeitada'}`,
        () => customer.storage.from(bucket).createSignedUrl(paths[index], 90),
      );
    }
    await mustBeDenied(
      'Cliente não consegue enviar imagem para product-images',
      () => customer.storage.from(bucket).upload(`${productIds[0]}/customer-forbidden.jpg`, imageBytes, { contentType: 'image/jpeg' }),
    );
  }

  // Update/delete authorization: a customer must not mutate an editor-owned object.
  const customerPayload = Buffer.concat([imageBytes, Buffer.from('customer-mutation')]);
  const updatedPayload = Buffer.concat([imageBytes, Buffer.from('editor-update')]);
  await mustSucceed(
    'Upload objeto de teste para update/delete',
    editor.storage.from(bucket).upload(mutablePath, imageBytes, { contentType: 'image/jpeg', upsert: false }),
  );
  if (customer) {
    try {
      await customer.storage.from(bucket).update(mutablePath, customerPayload, { contentType: 'image/jpeg' });
    } catch {
      // RLS denial may be returned as an error or an empty result; verify persisted bytes below.
    }
    const afterCustomerUpdate = await admin.storage.from(bucket).download(mutablePath);
    check(!afterCustomerUpdate.error && Buffer.from(await afterCustomerUpdate.data.arrayBuffer()).equals(imageBytes),
      'Cliente não consegue alterar objeto pertencente ao editor');

    try {
      await customer.storage.from(bucket).remove([mutablePath]);
    } catch {
      // RLS denial may be returned as an error or an empty result; verify object still exists below.
    }
    const afterCustomerDelete = await admin.storage.from(bucket).download(mutablePath);
    check(!afterCustomerDelete.error && Buffer.from(await afterCustomerDelete.data.arrayBuffer()).equals(imageBytes),
      'Cliente não consegue excluir objeto pertencente ao editor');
  }

  await mustSucceed(
    'Editor autorizado atualiza seu objeto',
    editor.storage.from(bucket).update(mutablePath, updatedPayload, { contentType: 'image/jpeg' }),
  );
  const afterEditorUpdate = await admin.storage.from(bucket).download(mutablePath);
  check(!afterEditorUpdate.error && Buffer.from(await afterEditorUpdate.data.arrayBuffer()).equals(updatedPayload),
    'Editor autorizado consegue atualizar seu objeto');

  await mustSucceed('Editor autorizado exclui seu objeto', editor.storage.from(bucket).remove([mutablePath]));
  const afterEditorDelete = await admin.storage.from(bucket).download(mutablePath);
  check(Boolean(afterEditorDelete.error), 'Editor autorizado consegue excluir seu objeto');

  console.log(`\nStorage integration tests passed: ${checks} checks.`);
} finally {
  // Cleanup runs with service_role even when an assertion fails.
  const cleanupPaths = [...paths, orphanPath, mutablePath, `${productIds[0]}/customer-forbidden.jpg`];
  const { error: removeError } = await admin.storage.from(bucket).remove(cleanupPaths);
  if (removeError) console.error(`Cleanup warning (objects): ${removeError.message}`);
  const { error: productCleanupError } = await admin.from('products').delete().in('id', productIds);
  if (productCleanupError) console.error(`Cleanup warning (products): ${productCleanupError.message}`);
  await editor.auth.signOut();
  await customer.auth.signOut();
}
