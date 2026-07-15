<template>
  <div class="settings-card provider-card">
    <div class="card-title provider-title">
      <span>多服务商发件</span>
      <el-tag type="success" effect="light">CloudMail Monet</el-tag>
    </div>
    <div class="card-content">
      <div class="provider-summary">
        <div>
          <div class="summary-label">当前域名</div>
          <div class="summary-domain">{{ selectedDomain || '未配置域名' }}</div>
        </div>
        <el-button type="primary" @click="openDialog" :disabled="!selectedDomain">
          <Icon icon="fluent:mail-settings-24-regular" width="18" />
          配置服务商
        </el-button>
      </div>
      <div class="provider-tags">
        <el-tag
            v-for="provider in providers"
            :key="provider.key"
            :type="providerEnabled(provider.key) ? 'success' : 'info'"
            effect="light"
        >
          {{ provider.name }} · {{ providerEnabled(provider.key) ? '已启用' : '未启用' }}
        </el-tag>
      </div>
      <div class="priority-line">
        <span>自动切换顺序</span>
        <span>{{ priorityText }}</span>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="多服务商发件设置" class="provider-dialog" width="860px">
      <div class="dialog-intro">
        密钥会在 Worker 中加密后保存到 D1，页面只显示掩码。留着掩码不改会保留原密钥。
      </div>

      <div class="form-row">
        <span>发件域名</span>
        <el-select v-model="selectedDomain" @change="loadForm" style="width: 240px">
          <el-option v-for="domain in normalizedDomains" :key="domain" :label="domain" :value="domain" />
        </el-select>
      </div>

      <div class="form-row priority-select">
        <span>故障切换顺序</span>
        <el-select v-model="priority" multiple style="width: min(560px, 100%)">
          <el-option v-for="provider in providers" :key="provider.key" :label="provider.name" :value="provider.key" />
        </el-select>
      </div>

      <el-tabs v-model="activeProvider" class="provider-tabs">
        <el-tab-pane v-for="provider in providers" :key="provider.key" :name="provider.key">
          <template #label>
            <span class="tab-label">
              <span class="status-dot" :class="form[provider.key].enabled ? 'enabled' : ''"></span>
              {{ provider.name }}
            </span>
          </template>

          <div class="provider-form">
            <div class="form-row">
              <span>启用</span>
              <el-switch v-model="form[provider.key].enabled" :active-value="1" :inactive-value="0" />
            </div>

            <template v-if="provider.key === 'resend' || provider.key === 'mailersend' || provider.key === 'brevo'">
              <div class="field-block">
                <label>API Key</label>
                <el-input v-model="form[provider.key].apiKey" type="password" show-password autocomplete="new-password" />
              </div>
            </template>

            <template v-if="provider.key === 'postmark'">
              <div class="field-block">
                <label>Server Token</label>
                <el-input v-model="form.postmark.serverToken" type="password" show-password autocomplete="new-password" />
              </div>
              <div class="field-block">
                <label>Message Stream</label>
                <el-input v-model="form.postmark.messageStream" placeholder="outbound" />
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
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="danger" plain @click="clearDomain">清除当前域名配置</el-button>
          <div>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="loading" @click="save">保存配置</el-button>
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
  loading: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const providers = [
  { key: 'resend', name: 'Resend' },
  { key: 'mailersend', name: 'MailerSend' },
  { key: 'brevo', name: 'Brevo' },
  { key: 'postmark', name: 'Postmark' },
  { key: 'ses', name: 'Amazon SES' }
];

const normalizedDomains = computed(() => props.domains.map(item => String(item).replace(/^@/, '')));
const selectedDomain = ref('');
const dialogVisible = ref(false);
const activeProvider = ref('resend');
const priority = ref(['resend', 'mailersend', 'brevo', 'postmark', 'ses']);
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

function copyIntoForm(value) {
  const next = defaultForm();
  for (const provider of providers) Object.assign(next[provider.key], value?.[provider.key] || {});
  for (const provider of providers) Object.assign(form[provider.key], next[provider.key]);
}

function loadForm() {
  copyIntoForm(props.setting?.mailProviders?.[selectedDomain.value]);
  priority.value = Array.isArray(props.setting?.providerPriority)
      ? [...props.setting.providerPriority]
      : ['resend', 'mailersend', 'brevo', 'postmark', 'ses'];
}

function openDialog() {
  loadForm();
  dialogVisible.value = true;
}

function providerEnabled(key) {
  return Number(props.setting?.mailProviders?.[selectedDomain.value]?.[key]?.enabled) === 1;
}

const priorityText = computed(() => {
  const list = Array.isArray(props.setting?.providerPriority) ? props.setting.providerPriority : priority.value;
  return list.map(key => providers.find(item => item.key === key)?.name || key).join(' → ');
});

function save() {
  emit('save', {
    providerPriority: [...priority.value],
    mailProviders: {
      [selectedDomain.value]: JSON.parse(JSON.stringify(form))
    }
  });
  dialogVisible.value = false;
}

function clearDomain() {
  emit('save', {
    mailProviders: {
      [selectedDomain.value]: { clear: true }
    }
  });
  dialogVisible.value = false;
}

watch(normalizedDomains, domains => {
  if (!selectedDomain.value || !domains.includes(selectedDomain.value)) selectedDomain.value = domains[0] || '';
  loadForm();
}, { immediate: true });
watch(() => props.setting?.mailProviders, loadForm, { deep: true });
</script>

<style scoped lang="scss">
.settings-card {
  background: color-mix(in srgb, var(--el-bg-color) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color));
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 14px 35px rgba(83, 108, 126, .10);
}
.card-title { padding: 13px 20px; border-bottom: 1px solid var(--el-border-color); font-weight: 700; }
.card-content { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.provider-title, .provider-summary, .priority-line, .form-row, .dialog-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.summary-label { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-domain { font-size: 18px; font-weight: 700; margin-top: 3px; }
.provider-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.priority-line { color: var(--el-text-color-secondary); font-size: 13px; }
.priority-line span:last-child { text-align: right; color: var(--el-text-color-primary); }
.dialog-intro { padding: 12px 14px; border-radius: 12px; background: var(--el-color-primary-light-9); color: var(--el-text-color-regular); margin-bottom: 18px; }
.form-row { margin: 14px 0; }
.form-row > span:first-child { font-weight: 600; }
.provider-tabs { margin-top: 18px; }
.tab-label { display: flex; align-items: center; gap: 7px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-info-light-5); }
.status-dot.enabled { background: var(--el-color-success); box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-success) 15%, transparent); }
.provider-form { min-height: 230px; padding: 16px 6px; }
.field-block { display: flex; flex-direction: column; gap: 7px; margin-bottom: 15px; }
.field-block label { font-size: 13px; color: var(--el-text-color-regular); }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 700px) {
  .provider-summary, .priority-line, .form-row { align-items: stretch; flex-direction: column; }
  .field-grid { grid-template-columns: 1fr; }
  .dialog-footer { align-items: stretch; flex-direction: column-reverse; }
  .dialog-footer > div { display: flex; justify-content: flex-end; }
}
</style>
