import analysisDao from '../dao/analysis-dao';
import orm from '../entity/orm';
import email from '../entity/email';
import { desc, count, eq, and, ne, isNotNull } from 'drizzle-orm';
import { emailConst } from '../const/entity-const';
import kvConst from '../const/kv-const';
import dayjs from 'dayjs';
import { toUtc } from '../utils/date-uitil';
import settingService from './setting-service';
const analysisService = {

	async echarts(c, params) {


		const { timeZone } = params;

		let utcDate = toUtc().startOf('day');

		let localDate = utcDate.tz(timeZone);

		utcDate = dayjs(utcDate.format('YYYY-MM-DD HH:mm:ss'))

		localDate = dayjs(localDate.format('YYYY-MM-DD HH:mm:ss'))

		//获取时差
		const diffHours = localDate.diff(utcDate, 'hour',true);


		const [
			numberCount,
			nameRatio,
			userDayCountRaw,
			receiveDayCountRaw,
			sendDayCountRaw,
			daySendTotalRaw
		] = await Promise.all([
			analysisDao.numberCount(c),

			orm(c)
				.select({ name: email.name, total: count() })
				.from(email)
				.where(and(eq(email.type, emailConst.type.RECEIVE), isNotNull(email.name),ne(email.name,'noreply'), ne(email.name,'')))
				.groupBy(email.name)
				.orderBy(desc(count()))
				.limit(6),


			analysisDao.userDayCount(c, diffHours),
			analysisDao.receiveDayCount(c, diffHours),
			analysisDao.sendDayCount(c, diffHours),

			c.env.kv.get(kvConst.SEND_DAY_COUNT + dayjs().format('YYYY-MM-DD')),
		]);


		const userDayCount = this.filterEmptyDay(userDayCountRaw, timeZone);
		const receiveDayCount = this.filterEmptyDay(receiveDayCountRaw, timeZone);
		const sendDayCount = this.filterEmptyDay(sendDayCountRaw, timeZone);

		const daySendTotal = daySendTotalRaw || 0;

		return {
			numberCount,
			userDayCount,
			receiveRatio: {
				nameRatio
			},
			emailDayCount: {
				receiveDayCount,
				sendDayCount
			},
			daySendTotal: Number(daySendTotal)
		};
	},

	async channels(c, params) {
		let timeZone = params.timeZone || 'UTC';
		let localNow;
		let diffHours = 0;

		try {
			const utcDate = toUtc().startOf('day');
			const localDate = utcDate.tz(timeZone);
			diffHours = dayjs(localDate.format('YYYY-MM-DD HH:mm:ss'))
				.diff(dayjs(utcDate.format('YYYY-MM-DD HH:mm:ss')), 'hour', true);
			localNow = toUtc().tz(timeZone);
		} catch (error) {
			timeZone = 'UTC';
			localNow = toUtc();
			diffHours = 0;
		}

		const datePattern = /^\d{4}-\d{2}-\d{2}$/;
		let endDate = datePattern.test(params.endDate || '')
			? params.endDate
			: localNow.format('YYYY-MM-DD');
		let startDate = datePattern.test(params.startDate || '')
			? params.startDate
			: localNow.subtract(29, 'day').format('YYYY-MM-DD');

		if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

		const direction = ['all', 'send', 'receive'].includes(params.direction)
			? params.direction
			: 'all';
		const channel = String(params.channel || 'all').toLowerCase().trim() || 'all';
		const page = Math.max(1, Number.parseInt(params.page) || 1);
		const pageSize = Math.min(100, Math.max(10, Number.parseInt(params.pageSize) || 20));

		const query = { diffHours, startDate, endDate, direction, channel, page, pageSize };
		const [summaryRaw, recordData, settingRow] = await Promise.all([
			analysisDao.channelSummary(c, query),
			analysisDao.channelRecords(c, query),
			settingService.query(c)
		]);

		const summary = summaryRaw.map(item => ({
			channel: item.channel,
			direction: item.direction,
			total: Number(item.total || 0)
		}));

		const records = recordData.records.map(item => {
			let target = item.toEmail || '';
			if (item.direction === 'send') {
				try {
					const recipient = JSON.parse(item.recipient || '[]');
					target = recipient.map(value => value.address || value.email || '').filter(Boolean).join(', ');
				} catch (error) {
					target = item.recipient || '';
				}
			}
			return {
				...item,
				target,
				subject: item.subject || '(无主题)',
				message: item.message || ''
			};
		});

		const availableChannels = [...new Set([
			...summary.map(item => item.channel),
			'resend', 'brevo', 'postmark', 'mailersend', 'ses', 'internal', 'cloudflare', 'legacy'
		])];

		return {
			filters: { startDate, endDate, direction, channel, timeZone },
			priority: Array.isArray(settingRow.providerPriority) ? settingRow.providerPriority : [],
			summary,
			availableChannels,
			total: recordData.total,
			records,
			page,
			pageSize
		};
	},

	filterEmptyDay(data, timeZone) {
		const today = toUtc().tz(timeZone).subtract(1, 'day');
		const previousDays = Array.from({ length: 15 }, (_, i) => {
			return today.subtract(i, 'day').format('YYYY-MM-DD');
		}).reverse();

		return  previousDays.map(day => {
			const index = data.findIndex(item => item.date === day)
			const total = index > - 1 ? data[index].total : 0
			return {date: day,total}
		})

	}
}

export default  analysisService
