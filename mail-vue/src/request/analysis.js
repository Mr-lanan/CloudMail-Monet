import http from '@/axios/index.js'

export function analysisEcharts(timeZone) {
    return http.get('/analysis/echarts',{params: {timeZone}});
}

export function analysisChannels(params) {
    return http.get('/analysis/channels', {params});
}
