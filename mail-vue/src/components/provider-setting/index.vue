<template>
  <div class="settings-card provider-card">
    <div class="card-title provider-title">
      <div class="title-copy">
        <span>多服务商发件</span>
        <small>按顺序自动尝试，失败后切换到下一家</small>
      </div>
      <el-tag type="success" effect="light" round>CloudMail Monet</el-tag>
    </div>

    <div class="card-content">
      <div class="provider-summary">
        <div class="domain-block">
          <div class="summary-label">当前域名</div>
          <div class="summary-domain">{{ selectedDomain || '未配置域名' }}</div>
        </div>
        <div class="summary-stat">
          <strong>{{ enabledCount }}</strong>
          <span>已启用</span>
        </div>
        <div class="summary-stat">
          <strong>{{ configuredCount }}</strong>
          <span>配置完整</span>
        </div>
        <el-button type="primary" @click="openDialog" :disabled="!selectedDomain">
          <Icon icon="fluent:mail-settings-24-regular" width="18" />
          配置服务商
        </el-button>
      </div>

      <div class="provider-status-grid">
        <button
            v-for="provider in providers"
            :key="provider.key"
            type="button"
            class="provider-chip"
            :class="providerStatusClass(provider.key)"
            @click="openProvider(provider.key)"
        >
          <span class="provider-mark">{{ provider.short }}</span>
          <span class="provider-chip-text">
            <strong>{{ provider.name }}</strong>
            <small>{{ providerStatusText(provider.key) }}</small>
          </span>
        </button>
      </div>

      <div class="priority-preview">
        <span class="summary-label">当前故障切换顺序</span>
        <div class="priority-flow">
          <template v-for="(provider, index) in orderedProviders" :key="provider.key">
            <span class="priority-node" :class="providerEnabled(provider.key) ? 'active' : ''">
              {{ index + 1 }}. {{ provider.name }}
            </span>
            <Icon v-if="index < orderedProviders.length - 1" icon="mingcute:right-line" width="15" />
          </template>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="dialogVisible" class="provider-config-page" @keydown.esc="closeConfig" tabindex="-1">
        <header class="provider-config-header">
          <el-button text circle class="back-button" :disabled="saving" @click="closeConfig" aria-label="返回系统设置">
            <Icon icon="mingcute:left-line" width="24" />
          </el-button>
          <div class="config-header-title">
            <strong>多服务商发件设置</strong>
            <small>{{ selectedDomain || '未选择域名' }}</small>
          </div>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </header>

        <main class="provider-config-main">
          <section class="config-intro">
            <Icon icon="solar:shield-keyhole-linear" width="23" />
            <div>
              <strong>密钥会加密保存</strong>
              <p>掩码内容保持不变即可保留原密钥。未启用或配置不完整的服务商会自动跳过。</p>
            </div>
          </section>

          <section class="config-section domain-section">
            <div class="section-heading">
              <div>
                <h2>发件域名</h2>
                <p>所有服务商配置都按域名单独保存</p>
              </div>
            </div>
            <el-select v-model="selectedDomain" @change="loadForm" style="width: 100%">
              <el-option v-for="domain in normalizedDomains" :key="domain" :label="domain" :value="domain" />
            </el-select>
          </section>

          <section class="config-section priority-section">
            <div class="section-heading">
              <div>
                <h2>故障切换顺序</h2>
                <p>从上到下依次尝试；手机使用上下按钮，电脑也可拖动</p>
              </div>
              <el-button link type="primary" @click="resetPriority">恢复默认</el-button>
            </div>

            <div class="priority-list">
              <div
                  v-for="(provider, index) in orderedProviders"
                  :key="provider.key"
                  class="priority-item"
                  :class="{ dragging: dragIndex === index }"
                  draggable="true"
                  @dragstart="onDragStart(index)"
                  @dragover.prevent
                  @drop="onDrop(index)"
                  @dragend="dragIndex = -1"
              >
                <Icon class="drag-handle" icon="mingcute:dots-line" width="20" />
                <span class="priority-number">{{ index + 1 }}</span>
                <button type="button" class="priority-provider" @click="focusProvider(provider.key)">
                  <strong>{{ provider.name }}</strong>
                  <small>{{ providerStatusText(provider.key) }}</small>
                </button>
                <el-tag
                    class="priority-status"
                    size="small"
                    round
                    :type="providerEnabled(provider.key) ? (providerConfigured(provider.key) ? 'success' : 'warning') : 'info'"
                >
                  {{ providerEnabled(provider.key) ? (providerConfigured(provider.key) ? '可用' : '缺少配置') : '未启用' }}
                </el-tag>
                <div class="priority-actions">
                  <el-button circle size="small" :disabled="index === 0" @click="moveProvider(index, -1)">
                    <Icon icon="mingcute:up-line" width="16" />
                  </el-button>
                  <el-button circle size="small" :disabled="index === orderedProviders.length - 1" @click="moveProvider(index, 1)">
                    <Icon icon="mingcute:down-line" width="16" />
                  </el-button>
                </div>
              </div>
            </div>
          </section>

          <section class="config-section provider-section">
            <div class="section-heading">
              <div>
                <h2>服务商配置</h2>
                <p>五家服务商分别独立配置，所有配置项直接显示，不再依赖选项卡切换</p>
              </div>
            </div>

            <div class="provider-forms-list">
              <article
                  v-for="provider in providers"
                  :id="`provider-config-${provider.key}`"
                  :key="provider.key"
                  class="provider-form provider-config-block"
                  :class="[providerStatusClass(provider.key), { focused: focusedProvider === provider.key }]"
              >
                <div class="provider-form-head">
                  <div class="provider-identity">
                    <span class="provider-mark">{{ provider.short }}</span>
                    <div>
                      <h3>{{ provider.name }}</h3>
                      <p>{{ provider.description }}</p>
                    </div>
                  </div>
                  <div class="enable-control">
                    <span>{{ form[provider.key].enabled ? '已启用' : '未启用' }}</span>
                    <el-switch v-model="form[provider.key].enabled" :active-value="1" :inactive-value="0" />
                  </div>
                </div>

                <template v-if="provider.key === 'resend' || provider.key === 'mailersend' || provider.key === 'brevo'">
                  <div class="field-block">
                    <label>API Key</label>
                    <el-input v-model="form[provider.key].apiKey" type="password" show-password autocomplete="new-password" />
                  </div>
                </template>

                <template v-if="provider.key === 'postmark'">
                  <div class="field-grid">
                    <div class="field-block">
                      <label>Server Token</label>
                      <el-input v-model="form.postmark.serverToken" type="password" show-password autocomplete="new-password" />
                    </div>
                    <div class="field-block">
                      <label>Message Stream</label>
                      <el-input v-model="form.postmark.messageStream" placeholder="outbound" />
                    </div>
                  </div>
                </template>

                <template v-if="provider.key === 'ses'">
                  <div class="field-grid">
                    <div class="field-block">
                      <label>Access Key ID</label>
                      <el-input v-model="form.ses.accessKeyId" type="password" show-password autocomplete="new-password" />
                    </div>
                    <div class="field-block">
                      <label>Secret Access Key</label>
                      <el-input v-model="form.ses.secretAccessKey" type="password" show-password autocomplete="new-password" />
                    </div>
                    <div class="field-block">
                      <label>Session Token（可选）</label>
                      <el-input v-model="form.ses.sessionToken" type="password" show-password autocomplete="new-password" />
                    </div>
                    <div class="field-block">
                      <label>Region</label>
                      <el-input v-model="form.ses.region" placeholder="us-east-1" />
                    </div>
                  </div>
                </template>

                <el-alert
                    v-if="form[provider.key].enabled && !providerConfigured(provider.key)"
                    title="该服务商已经启用，但配置还不完整；发送时会自动跳过。"
                    type="warning"
                    :closable="false"
                    show-icon
                />

                <div class="provider-danger-row">
                  <el-button type="danger" plain :disabled="saving" @click="clearProvider(provider.key)">
                    清除此服务商配置
                  </el-button>
                </div>
              </article>
            </div>
          </section>
        </main>

        <footer class="provider-config-footer">
          <el-button type="danger" plain :loading="saving" @click="clearDomain">清除当前域名配置</el-button>
          <div class="footer-actions">
            <el-button :disabled="saving" @click="closeConfig">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
          </div>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
  setting: { type: Object, required: true },
  domains: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  saveHandler: { type: Function, required: true }
});

const providers = [
  { key: 'resend', name: 'Resend', short: 'R', description: '配置简单，适合作为主发件通道。' },
  { key: 'mailersend', name: 'MailerSend', short: 'M', description: '支持事务邮件、附件和内嵌图片。' },
  { key: 'brevo', name: 'Brevo', short: 'B', description: '使用 Brevo Transactional Email API 发送。' },
  { key: 'postmark', name: 'Postmark', short: 'P', description: '使用 Server Token 与事务邮件流发送。' },
  { key: 'ses', name: 'Amazon SES', short: 'S', description: '适合大规模发送，需要 AWS SES 凭证和区域。' }
];
const defaultPriority = providers.map(item => item.key);

const normalizedDomains = computed(() => props.domains.map(item => String(item).replace(/^@/, '')));
const selectedDomain = ref('');
const dialogVisible = ref(false);
const focusedProvider = ref('');
const priority = ref([...defaultPriority]);
const dragIndex = ref(-1);
const localSaving = ref(false);
const saving = computed(() => props.loading || localSaving.value);
const form = reactive(defaultForm());

function defaultForm() {
  return {
    resend: { enabled: 0, apiKey: '' },
    mailersend: { enabled: 0, apiKey: '' },
    brevo: { enabled: 0, apiKey: '' },
    postmark: { enabled: 0, serverToken: '', messageStream: 'outbound' },
    ses: { enabled: 0, accessKeyId: '', secretAccessKey: '', sessionToken: '', region: 'us-east-1' }
  };
}

function normalizePriority(value) {
  const result = [];
  for (const key of Array.isArray(value) ? value : []) {
    if (defaultPriority.includes(key) && !result.includes(key)) result.push(key);
  }
  for (const key of defaultPriority) {
    if (!result.includes(key)) result.push(key);
  }
  return result;
}

function copyIntoForm(value) {
  const next = defaultForm();
  for (const provider of providers) Object.assign(next[provider.key], value?.[provider.key] || {});
  for (const provider of providers) Object.assign(form[provider.key], next[provider.key]);
}

function loadForm() {
  copyIntoForm(props.setting?.mailProviders?.[selectedDomain.value]);
  priority.value = normalizePriority(props.setting?.providerPriority);
}

function openDialog() {
  loadForm();
  focusedProvider.value = '';
  dialogVisible.value = true;
}

async function openProvider(key) {
  loadForm();
  focusedProvider.value = key;
  dialogVisible.value = true;
  await nextTick();
  document.getElementById(`provider-config-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    if (focusedProvider.value === key) focusedProvider.value = '';
  }, 1500);
}

async function focusProvider(key) {
  focusedProvider.value = key;
  await nextTick();
  document.getElementById(`provider-config-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    if (focusedProvider.value === key) focusedProvider.value = '';
  }, 1500);
}

function closeConfig() {
  if (saving.value) return;
  loadForm();
  dialogVisible.value = false;
}

function providerEnabled(key) {
  const source = dialogVisible.value ? form : props.setting?.mailProviders?.[selectedDomain.value];
  return Number(source?.[key]?.enabled) === 1;
}

function providerConfigured(key) {
  const config = dialogVisible.value ? form[key] : props.setting?.mailProviders?.[selectedDomain.value]?.[key];
  if (!config) return false;
  if (key === 'resend' || key === 'mailersend' || key === 'brevo') return Boolean(config.apiKey);
  if (key === 'postmark') return Boolean(config.serverToken && (config.messageStream || 'outbound').trim());
  if (key === 'ses') return Boolean(config.accessKeyId && config.secretAccessKey && config.region);
  return false;
}

function providerStatusClass(key) {
  if (!providerEnabled(key)) return 'disabled';
  return providerConfigured(key) ? 'ready' : 'warning';
}

function providerStatusText(key) {
  if (!providerEnabled(key)) return '未启用';
  return providerConfigured(key) ? '已启用 · 配置完整' : '已启用 · 缺少配置';
}

const orderedProviders = computed(() => normalizePriority(priority.value).map(key => providers.find(item => item.key === key)));
const enabledCount = computed(() => providers.filter(item => providerEnabled(item.key)).length);
const configuredCount = computed(() => providers.filter(item => providerEnabled(item.key) && providerConfigured(item.key)).length);

function moveProvider(index, step) {
  const next = index + step;
  if (next < 0 || next >= priority.value.length) return;
  const list = [...priority.value];
  [list[index], list[next]] = [list[next], list[index]];
  priority.value = list;
}

function onDragStart(index) {
  dragIndex.value = index;
}

function onDrop(index) {
  if (dragIndex.value < 0 || dragIndex.value === index) return;
  const list = [...priority.value];
  const [moved] = list.splice(dragIndex.value, 1);
  list.splice(index, 0, moved);
  priority.value = list;
  dragIndex.value = -1;
}

function resetPriority() {
  priority.value = [...defaultPriority];
}

async function save() {
  if (saving.value || !selectedDomain.value) return;
  localSaving.value = true;
  try {
    await props.saveHandler({
      providerPriority: normalizePriority(priority.value),
      mailProviders: {
        [selectedDomain.value]: JSON.parse(JSON.stringify(form))
      }
    });
    dialogVisible.value = false;
  } catch (error) {
    console.error('保存服务商配置失败：', error);
  } finally {
    localSaving.value = false;
  }
}

async function clearProvider(key) {
  if (saving.value || !selectedDomain.value) return;
  const provider = providers.find(item => item.key === key);
  try {
    await ElMessageBox.confirm(
        `确认清除 ${provider?.name || key} 的密钥和配置吗？`,
        '清除服务商',
        { confirmButtonText: '确认清除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  localSaving.value = true;
  try {
    await props.saveHandler({
      mailProviders: {
        [selectedDomain.value]: {
          [key]: { clear: true }
        }
      }
    });
    copyIntoForm(props.setting?.mailProviders?.[selectedDomain.value]);
  } catch (error) {
    console.error('清除服务商配置失败：', error);
  } finally {
    localSaving.value = false;
  }
}

async function clearDomain() {
  if (saving.value || !selectedDomain.value) return;
  try {
    await ElMessageBox.confirm(
        `确认清除 ${selectedDomain.value} 的全部服务商密钥和开关吗？`,
        '清除服务商配置',
        { confirmButtonText: '确认清除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  localSaving.value = true;
  try {
    await props.saveHandler({
      mailProviders: {
        [selectedDomain.value]: { clear: true }
      }
    });
    dialogVisible.value = false;
  } catch (error) {
    console.error('清除域名服务商配置失败：', error);
  } finally {
    localSaving.value = false;
  }
}

watch(dialogVisible, visible => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('provider-config-open', visible);
});

onUnmounted(() => {
  if (typeof document !== 'undefined') document.documentElement.classList.remove('provider-config-open');
});

watch(normalizedDomains, domains => {
  if (!selectedDomain.value || !domains.includes(selectedDomain.value)) selectedDomain.value = domains[0] || '';
  loadForm();
}, { immediate: true });
watch(() => props.setting?.mailProviders, loadForm, { deep: true });
watch(() => props.setting?.providerPriority, value => {
  priority.value = normalizePriority(value);
}, { deep: true });
</script>

<style scoped lang="scss">
:global(html.provider-config-open),
:global(html.provider-config-open body) {
  overflow: hidden !important;
  overscroll-behavior: none;
}

.provider-card,
.provider-card * {
  box-sizing: border-box;
}

.provider-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color));
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 16px 42px rgba(59, 84, 103, .11);
}

.provider-title,
.provider-summary,
.provider-form-head,
.section-heading,
.provider-config-header,
.provider-config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.provider-title { padding: 16px 20px; }
.title-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.title-copy > span { font-size: 16px; font-weight: 750; }
.title-copy small { color: var(--el-text-color-secondary); font-weight: 400; }
.card-content { width: 100%; min-width: 0; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.provider-summary { min-width: 0; flex-wrap: wrap; }
.domain-block { min-width: 150px; flex: 1 1 180px; }
.summary-label { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-domain { max-width: 100%; overflow-wrap: anywhere; font-size: 20px; font-weight: 760; margin-top: 3px; letter-spacing: .2px; }
.summary-stat {
  min-width: 78px;
  padding: 9px 13px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 72%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.summary-stat strong { font-size: 18px; line-height: 1.1; }
.summary-stat span { margin-top: 3px; color: var(--el-text-color-secondary); font-size: 11px; }

.provider-status-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 9px;
}
.provider-chip,
.provider-select-button {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px;
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
.provider-chip:hover,
.provider-select-button:hover { transform: translateY(-1px); border-color: var(--el-color-primary-light-5); box-shadow: 0 8px 20px rgba(70, 95, 116, .10); }
.provider-chip.ready,
.provider-select-button.ready { background: color-mix(in srgb, var(--el-color-success-light-9) 75%, transparent); }
.provider-chip.warning,
.provider-select-button.warning { background: color-mix(in srgb, var(--el-color-warning-light-9) 78%, transparent); }
.provider-mark {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(145deg, #6b91aa, #9388ad);
}
.provider-chip-text,
.provider-select-copy { min-width: 0; display: flex; flex-direction: column; }
.provider-chip-text strong,
.provider-chip-text small,
.provider-select-copy strong,
.provider-select-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-chip-text small,
.provider-select-copy small { color: var(--el-text-color-secondary); }

.priority-preview {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 15px;
  background: color-mix(in srgb, var(--el-fill-color-light) 74%, transparent);
  overflow: hidden;
}
.priority-flow { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 7px; color: var(--el-text-color-secondary); }
.priority-node { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 8px; border-radius: 999px; background: var(--el-fill-color); font-size: 12px; }
.priority-node.active { color: var(--el-color-primary); background: var(--el-color-primary-light-9); font-weight: 650; }

.provider-config-page {
  position: fixed;
  inset: 0;
  z-index: 4000;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  color: var(--el-text-color-primary);
  background:
      radial-gradient(circle at 12% 4%, color-mix(in srgb, var(--el-color-primary) 18%, transparent), transparent 32%),
      radial-gradient(circle at 88% 10%, rgba(143, 113, 160, .14), transparent 30%),
      var(--el-bg-color-page);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.provider-config-header {
  min-height: 66px;
  padding: max(10px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left));
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 78%, transparent);
  background: color-mix(in srgb, var(--el-bg-color) 91%, transparent);
  backdrop-filter: blur(18px) saturate(118%);
}
.back-button { flex: 0 0 auto; }
.config-header-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.config-header-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; }
.config-header-title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--el-text-color-secondary); }

.provider-config-main {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px max(16px, env(safe-area-inset-right)) 28px max(16px, env(safe-area-inset-left));
}
.provider-config-main > * { width: min(860px, 100%); margin-left: auto; margin-right: auto; box-sizing: border-box; }

.config-intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), color-mix(in srgb, var(--el-color-success-light-9) 65%, transparent));
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 16%, transparent);
}
.config-intro p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.65; }

.config-section {
  margin-top: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 16%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  box-shadow: 0 12px 34px rgba(49, 69, 84, .08);
}
.section-heading { margin-bottom: 14px; }
.section-heading h2 { margin: 0; font-size: 16px; }
.section-heading p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.55; }

.priority-list { display: flex; flex-direction: column; gap: 8px; }
.priority-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 22px 28px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 13px;
  border: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-bg-color) 92%, transparent);
  transition: opacity .15s ease, transform .15s ease, border-color .15s ease;
}
.priority-item.dragging { opacity: .5; transform: scale(.99); }
.drag-handle { color: var(--el-text-color-placeholder); cursor: grab; }
.priority-number { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 9px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 750; }
.priority-provider { min-width: 0; padding: 0; border: 0; color: inherit; background: transparent; display: flex; flex-direction: column; text-align: left; cursor: pointer; }
.priority-provider strong,
.priority-provider small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.priority-provider small { color: var(--el-text-color-secondary); font-size: 11px; }
.priority-actions { display: flex; gap: 4px; }

.provider-forms-list { display: flex; flex-direction: column; gap: 12px; }
.provider-form {
  margin: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, transparent);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
  scroll-margin: 92px;
}
.provider-form.ready { border-color: color-mix(in srgb, var(--el-color-success) 35%, var(--el-border-color-lighter)); }
.provider-form.warning { border-color: color-mix(in srgb, var(--el-color-warning) 40%, var(--el-border-color-lighter)); }
.provider-form.focused {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-primary) 14%, transparent), 0 16px 36px rgba(54, 77, 96, .13);
  transform: translateY(-1px);
}
.provider-identity { min-width: 0; display: flex; align-items: flex-start; gap: 11px; }
.provider-identity > div { min-width: 0; }
.provider-form-head { align-items: flex-start; margin-bottom: 18px; }
.provider-form-head h3 { margin: 0; font-size: 18px; }
.provider-form-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.55; }
.enable-control { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.field-block { display: flex; flex-direction: column; gap: 7px; margin-bottom: 15px; }
.field-block label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 650; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.provider-danger-row { display: flex; justify-content: flex-end; margin-top: 18px; }

.provider-config-footer {
  min-height: 72px;
  padding: 10px max(16px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 78%, transparent);
  background: color-mix(in srgb, var(--el-bg-color) 93%, transparent);
  backdrop-filter: blur(18px) saturate(118%);
}
.footer-actions { display: flex; gap: 8px; }

@media (max-width: 860px) {
  .provider-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .provider-title { align-items: flex-start; }
  .provider-title .el-tag { flex: 0 0 auto; }
  .card-content { padding: 16px; }
  .provider-summary { align-items: stretch; }
  .provider-summary .el-button { width: 100%; }
  .summary-stat { flex: 1 1 78px; }
  .provider-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .provider-chip { padding: 9px; }
  .provider-chip-text small { font-size: 11px; }
  .priority-flow > svg { display: none; }
  .priority-node { flex: 1 1 calc(50% - 6px); text-align: center; }

  .provider-config-header { gap: 8px; }
  .provider-config-header > .el-button:last-child { min-width: 64px; }
  .provider-config-main { padding-top: 14px; }
  .config-section { padding: 15px; border-radius: 16px; }
  .section-heading { align-items: flex-start; }
  .priority-item { grid-template-columns: 20px 28px minmax(0, 1fr) auto; padding: 9px 8px; }
  .priority-status { display: none; }
  .priority-actions { gap: 2px; }
  .priority-actions :deep(.el-button) { width: 30px; height: 30px; }
  .provider-form { padding: 14px; }
  .provider-form-head { flex-direction: column; align-items: stretch; }
  .enable-control { justify-content: flex-end; }
  .field-grid { grid-template-columns: 1fr; }
  .provider-danger-row .el-button { width: 100%; }
  .provider-config-footer { align-items: stretch; flex-direction: column-reverse; }
  .provider-config-footer > .el-button { width: 100%; }
  .footer-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .footer-actions .el-button { width: 100%; margin: 0; }
}
</style>
