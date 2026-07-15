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
        <div>
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
    </div>

    <el-dialog
        v-model="dialogVisible"
        title="多服务商发件设置"
        class="provider-dialog"
        width="900px"
        :close-on-click-modal="false"
        destroy-on-close
    >
      <div class="dialog-intro">
        <Icon icon="solar:shield-keyhole-linear" width="22" />
        <div>
          <strong>密钥会加密保存</strong>
          <p>掩码内容保持不变即可保留原密钥。排序仅影响站外发件，未启用或配置不完整的服务商会自动跳过。</p>
        </div>
      </div>

      <div class="dialog-top-grid">
        <div class="field-block compact-field">
          <label>发件域名</label>
          <el-select v-model="selectedDomain" @change="loadForm" style="width: 100%">
            <el-option v-for="domain in normalizedDomains" :key="domain" :label="domain" :value="domain" />
          </el-select>
        </div>

        <div class="priority-editor">
          <div class="priority-editor-head">
            <div>
              <strong>故障切换顺序</strong>
              <small>拖动或使用上下按钮调整</small>
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
              <div class="priority-provider" @click="activeProvider = provider.key">
                <strong>{{ provider.name }}</strong>
                <small>{{ providerStatusText(provider.key) }}</small>
              </div>
              <el-tag
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
        </div>
      </div>

      <el-tabs v-model="activeProvider" class="provider-tabs">
        <el-tab-pane v-for="provider in providers" :key="provider.key" :name="provider.key">
          <template #label>
            <span class="tab-label">
              <span class="status-dot" :class="providerStatusClass(provider.key)"></span>
              {{ provider.name }}
            </span>
          </template>

          <div class="provider-form">
            <div class="provider-form-head">
              <div>
                <h3>{{ provider.name }}</h3>
                <p>{{ provider.description }}</p>
              </div>
              <div class="enable-control">
                <el-button type="danger" link :disabled="saving" @click="clearProvider(provider.key)">清除此服务商</el-button>
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
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="danger" plain :loading="saving" @click="clearDomain">清除当前域名配置</el-button>
          <div>
            <el-button :disabled="saving" @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
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
const activeProvider = ref('resend');
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
  dialogVisible.value = true;
}

function openProvider(key) {
  activeProvider.value = key;
  openDialog();
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
.settings-card {
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color));
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 16px 42px rgba(59, 84, 103, .11);
}
.provider-title, .provider-summary, .dialog-footer, .provider-form-head, .priority-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.provider-title { padding: 16px 20px; }
.title-copy { display: flex; flex-direction: column; gap: 2px; }
.title-copy > span { font-size: 16px; font-weight: 750; }
.title-copy small, .priority-editor-head small { color: var(--el-text-color-secondary); font-weight: 400; }
.card-content { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.provider-summary { flex-wrap: wrap; }
.domain-block { min-width: 180px; flex: 1; }
.summary-label { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-domain { font-size: 20px; font-weight: 760; margin-top: 3px; letter-spacing: .2px; }
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
.provider-status-grid { display: grid; grid-template-columns: repeat(5, minmax(112px, 1fr)); gap: 9px; }
.provider-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 10px;
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.provider-chip:hover { transform: translateY(-2px); border-color: var(--el-color-primary-light-5); box-shadow: 0 8px 20px rgba(70, 95, 116, .10); }
.provider-chip.ready { background: color-mix(in srgb, var(--el-color-success-light-9) 75%, transparent); }
.provider-chip.warning { background: color-mix(in srgb, var(--el-color-warning-light-9) 78%, transparent); }
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
.provider-chip-text { min-width: 0; display: flex; flex-direction: column; }
.provider-chip-text strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-chip-text small { color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.priority-preview { padding: 12px 14px; border-radius: 15px; background: color-mix(in srgb, var(--el-fill-color-light) 74%, transparent); }
.priority-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 7px; color: var(--el-text-color-secondary); }
.priority-node { padding: 4px 8px; border-radius: 999px; background: var(--el-fill-color); font-size: 12px; }
.priority-node.active { color: var(--el-color-primary); background: var(--el-color-primary-light-9); font-weight: 650; }
.dialog-intro {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 15px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), color-mix(in srgb, var(--el-color-success-light-9) 65%, transparent));
  color: var(--el-text-color-regular);
  margin-bottom: 18px;
}
.dialog-intro p { margin-top: 3px; font-size: 12px; color: var(--el-text-color-secondary); }
.dialog-top-grid { display: grid; grid-template-columns: minmax(210px, .7fr) minmax(420px, 1.3fr); gap: 18px; align-items: start; }
.compact-field { margin: 0; padding: 15px; border-radius: 15px; border: 1px solid var(--el-border-color-lighter); background: var(--el-fill-color-lighter); }
.priority-editor { padding: 15px; border-radius: 15px; border: 1px solid var(--el-border-color-lighter); background: color-mix(in srgb, var(--el-fill-color-lighter) 75%, transparent); }
.priority-editor-head > div { display: flex; flex-direction: column; }
.priority-list { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }
.priority-item {
  display: grid;
  grid-template-columns: 22px 28px minmax(120px, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  transition: opacity .15s ease, transform .15s ease;
}
.priority-item.dragging { opacity: .5; transform: scale(.99); }
.drag-handle { color: var(--el-text-color-placeholder); cursor: grab; }
.priority-number { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 9px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 750; }
.priority-provider { display: flex; flex-direction: column; min-width: 0; cursor: pointer; }
.priority-provider small { color: var(--el-text-color-secondary); font-size: 11px; }
.priority-actions { display: flex; gap: 4px; }
.provider-tabs { margin-top: 20px; }
.tab-label { display: flex; align-items: center; gap: 7px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-info-light-5); }
.status-dot.ready { background: var(--el-color-success); box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-success) 15%, transparent); }
.status-dot.warning { background: var(--el-color-warning); box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-warning) 15%, transparent); }
.status-dot.disabled { background: var(--el-color-info-light-5); }
.provider-form { min-height: 238px; padding: 18px 7px 6px; }
.provider-form-head { margin-bottom: 18px; }
.provider-form-head h3 { font-size: 17px; }
.provider-form-head p { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.enable-control { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.field-block { display: flex; flex-direction: column; gap: 7px; margin-bottom: 15px; }
.field-block label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 650; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.dialog-footer > div { display: flex; gap: 8px; }
@media (max-width: 860px) {
  .provider-status-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
  .dialog-top-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .provider-summary { align-items: stretch; }
  .provider-summary .el-button { width: 100%; }
  .summary-stat { flex: 1; }
  .provider-status-grid { grid-template-columns: 1fr; }
  .priority-item { grid-template-columns: 22px 28px minmax(100px, 1fr) auto; }
  .priority-item > .el-tag { display: none; }
  .field-grid { grid-template-columns: 1fr; }
  .dialog-footer { align-items: stretch; flex-direction: column-reverse; }
  .dialog-footer > div { display: grid; grid-template-columns: 1fr 1fr; }
  .dialog-footer > .el-button { width: 100%; }
}
</style>
