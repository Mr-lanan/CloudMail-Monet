<template>
  <el-scrollbar class="scroll">
    <div>
      <div class="title">
        <div class="brand-icon"><Icon icon="mdi:email-outline" width="22" height="22" /></div>
        <div class="brand-copy">
          <strong>{{ settingStore.settings.title || 'CloudMail' }}</strong>
          <span>MONET MAIL STUDIO</span>
        </div>
      </div>
      <el-menu :collapse="false" text-color="#fff" active-text-color="#fff" style="margin-top: 10px">
        <el-menu-item @click="router.push({name: 'email'})" index="email"
                      :class="route.meta.name === 'email' ? 'choose-item' : ''">
          <Icon icon="hugeicons:mailbox-01" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('inbox')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'send'})" index="send" v-perm="'email:send'"
                      :class="route.meta.name === 'send' ? 'choose-item' : ''">
          <Icon icon="cil:send" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('sent')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'draft'})" index="draft" v-perm="'email:send'"
                      :class="route.meta.name === 'draft' ? 'choose-item' : ''">
          <Icon icon="ep:document" width="19" height="19" />
          <span class="menu-name" style="margin-left: 22px">{{$t('drafts')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'star'})" index="star"
                      :class="route.meta.name === 'star' ? 'choose-item' : ''">
          <Icon icon="solar:star-line-duotone" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('starred')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'setting'})" index="setting"
                      :class="route.meta.name === 'setting' ? 'choose-item' : ''">
          <Icon icon="fluent:settings-48-regular" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('settings')}}</span>
        </el-menu-item>
        <div class="manage-title" v-perm="['all-email:query','user:query','role:query','setting:query','analysis:query','reg-key:query']">
          <div>{{$t('manage')}}</div>
        </div>
        <el-menu-item @click="router.push({name: 'analysis'})" index="analysis" v-perm="'analysis:query'"
                      :class="route.meta.name === 'analysis' ? 'choose-item' : ''">
          <Icon icon="fluent:data-pie-20-regular" width="24" height="24" />
          <span class="menu-name" style="margin-left: 18px">{{$t('analytics')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'user'})" index="setting" v-perm="'user:query'"
                      :class="route.meta.name === 'user' ? 'choose-item' : ''">
          <Icon icon="si:user-alt-2-line" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('allUsers')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'all-email'})" index="all-email" v-perm="'all-email:query'"
                      :class="route.meta.name === 'all-email' ? 'choose-item' : ''">
          <Icon icon="fluent:mail-list-28-regular" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('allMail')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'role'})" index="setting" v-perm="'role:query'"
                      :class="route.meta.name === 'role' ? 'choose-item' : ''">
          <Icon icon="fluent:lock-closed-16-regular" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('permissions')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'reg-key'})" index="reg-key" v-perm="'reg-key:query'"
                      :class="route.meta.name === 'reg-key' ? 'choose-item' : ''">
          <Icon icon="fluent:fingerprint-20-filled" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('inviteCode')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'sys-setting'})" index="sys-setting" v-perm="'setting:query'"
                      :class="route.meta.name === 'sys-setting' ? 'choose-item' : ''">
          <Icon icon="eos-icons:system-ok-outlined" width="18" height="18" style="margin-left: 2px" />
          <span class="menu-name" style="margin-left: 22px">{{$t('SystemSettings')}}</span>
        </el-menu-item>
      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";

const settingStore = useSettingStore();
const route = useRoute();

</script>

<style lang="scss" scoped>
.title {
  margin: 16px 14px 12px;
  min-height: 62px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: #fff;
  background:
      radial-gradient(circle at 12% 0%, rgba(255,255,255,.24), transparent 35%),
      linear-gradient(135deg, #789eb3, #958bb2 56%, #7ca28f);
  box-shadow: 0 14px 32px rgba(36, 59, 73, .30);
  padding: 10px 13px;
}
.brand-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.24);
  backdrop-filter: blur(8px);
}
.brand-copy { min-width: 0; display: flex; flex-direction: column; }
.brand-copy strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 15px; letter-spacing: .2px; }
.brand-copy span { margin-top: 2px; font-size: 9px; letter-spacing: 1.15px; color: rgba(255,255,255,.72); }
.manage-title {
  margin: 18px 18px 7px;
  color: rgba(255,255,255,.58);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 1.2px;
}
.el-menu-item {
  margin: 5px 11px !important;
  border-radius: 13px;
  height: 42px;
  padding: 10px 13px !important;
  transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
}
.choose-item {
  font-weight: 700;
  background: linear-gradient(90deg, rgba(255,255,255,.19), rgba(255,255,255,.08)) !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), 0 8px 20px rgba(26,43,52,.16);
  backdrop-filter: blur(8px);
}
@media (hover: hover) {
  .el-menu-item:hover {
    transform: translateX(3px);
    background: rgba(255,255,255,.11) !important;
  }
}
.menu-name { user-select: none; }
:deep(.el-scrollbar__wrap--hidden-default) {
  background:
      radial-gradient(circle at 40% 4%, rgba(175, 203, 218, .18), transparent 24%),
      linear-gradient(180deg, #425f70 0%, #526c77 47%, #4c695e 100%) !important;
}
:deep(.el-menu-item), :deep(.el-menu) { background: transparent; }
.el-menu { border-right: 0; width: 260px; }
:deep(.el-divider__text) { background: transparent; color: #fff; }
</style>
