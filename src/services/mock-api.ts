import type { RouteData, MarkerData, TileResponse } from '../types';
import { StorageService } from './storage.service';
import { haversineDistance } from '../utils/distance';
import { generateId } from '../utils/id';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPresetRoutes(): RouteData[] {
  const now = Date.now();

  const sichuanTibetMarkers: MarkerData[] = [
    { id: generateId(), type: 'attraction', lat: 30.5728, lng: 104.0668, name: '成都·天府广场', note: '川藏线起点，天府之国', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'attraction', lat: 29.9800, lng: 103.0000, name: '雅安·二郎山', note: '川藏公路第一险', photoUrls: [], stayDuration: 60 },
    { id: generateId(), type: 'attraction', lat: 30.0500, lng: 101.9600, name: '康定·跑马山', note: '情歌故里，藏汉门户', photoUrls: [], stayDuration: 90 },
    { id: generateId(), type: 'hotel', lat: 30.0400, lng: 101.4900, name: '新都桥', note: '摄影天堂，宿新都桥', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 29.0300, lng: 100.3000, name: '稻城亚丁', note: '蓝色星球上最后一片净土', photoUrls: [], stayDuration: 480 },
    { id: generateId(), type: 'gas', lat: 30.0600, lng: 99.1000, name: '巴塘加油站', note: '进藏前最后一个县城', photoUrls: [], stayDuration: 30 },
    { id: generateId(), type: 'attraction', lat: 29.6800, lng: 98.5900, name: '芒康·盐井', note: '千年古盐田', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'restaurant', lat: 30.0500, lng: 96.9200, name: '八宿·然乌湖', note: '雪山下的圣湖', photoUrls: [], stayDuration: 90 },
    { id: generateId(), type: 'hotel', lat: 29.6500, lng: 94.3600, name: '林芝·八一镇', note: '雪域江南，宿林芝', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 29.6500, lng: 91.1000, name: '拉萨·布达拉宫', note: '终点，日光之城', photoUrls: [], stayDuration: 480 }
  ];

  const northwestLoopMarkers: MarkerData[] = [
    { id: generateId(), type: 'attraction', lat: 36.6171, lng: 101.7782, name: '西宁·塔尔寺', note: '西北环线起点', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'attraction', lat: 36.9100, lng: 100.1500, name: '青海湖·二郎剑', note: '中国最大咸水湖', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'hotel', lat: 36.8000, lng: 99.7600, name: '茶卡盐湖', note: '天空之镜，宿茶卡', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 38.2500, lng: 95.3500, name: '大柴旦·翡翠湖', note: '绝美盐湖秘境', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'attraction', lat: 40.1400, lng: 94.6600, name: '敦煌·莫高窟', note: '千年文化瑰宝', photoUrls: [], stayDuration: 300 },
    { id: generateId(), type: 'restaurant', lat: 40.0800, lng: 94.6000, name: '鸣沙山月牙泉', note: '沙漠中的一汪清泉', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'hotel', lat: 39.7700, lng: 98.2900, name: '嘉峪关', note: '天下第一雄关', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 38.8300, lng: 100.5300, name: '张掖·七彩丹霞', note: '上帝打翻的调色盘', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'gas', lat: 37.9500, lng: 101.3000, name: '门源加油站', note: '万亩油菜花海', photoUrls: [], stayDuration: 60 },
    { id: generateId(), type: 'attraction', lat: 36.6171, lng: 101.7782, name: '西宁', note: '环线终点', photoUrls: [], stayDuration: 60 }
  ];

  const yunnanLoopMarkers: MarkerData[] = [
    { id: generateId(), type: 'attraction', lat: 25.0389, lng: 102.7183, name: '昆明·滇池', note: '云南环线起点，春城', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'attraction', lat: 25.6000, lng: 100.2600, name: '大理·洱海', note: '风花雪月，苍山洱海', photoUrls: [], stayDuration: 360 },
    { id: generateId(), type: 'hotel', lat: 25.6100, lng: 100.2700, name: '大理古城', note: '宿大理古城', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 26.8700, lng: 100.2300, name: '丽江·玉龙雪山', note: '纳西神山', photoUrls: [], stayDuration: 300 },
    { id: generateId(), type: 'restaurant', lat: 26.8721, lng: 100.2299, name: '丽江古城', note: '世界文化遗产', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'attraction', lat: 27.8300, lng: 99.7100, name: '香格里拉·普达措', note: '心中的日月', photoUrls: [], stayDuration: 240 },
    { id: generateId(), type: 'hotel', lat: 27.8300, lng: 99.7100, name: '独克宗古城', note: '月光之城，宿香格里拉', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 25.0100, lng: 98.4900, name: '腾冲·和顺古镇', note: '极边第一城', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'gas', lat: 24.4300, lng: 97.8500, name: '瑞丽加油站', note: '中缅边境口岸', photoUrls: [], stayDuration: 60 },
    { id: generateId(), type: 'attraction', lat: 25.0389, lng: 102.7183, name: '昆明', note: '环线终点', photoUrls: [], stayDuration: 60 }
  ];

  const xinjiangDukuMarkers: MarkerData[] = [
    { id: generateId(), type: 'attraction', lat: 43.8256, lng: 87.6168, name: '乌鲁木齐·天山天池', note: '独库公路起点', photoUrls: [], stayDuration: 180 },
    { id: generateId(), type: 'gas', lat: 44.3200, lng: 84.8700, name: '独山子加油站', note: '独库公路北起点', photoUrls: [], stayDuration: 30 },
    { id: generateId(), type: 'attraction', lat: 43.6000, lng: 84.5000, name: '乔尔玛·烈士陵园', note: '致敬筑路英雄', photoUrls: [], stayDuration: 60 },
    { id: generateId(), type: 'hotel', lat: 43.4600, lng: 84.7700, name: '那拉提草原', note: '空中草原，宿那拉提', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 43.4600, lng: 84.7700, name: '那拉提空中草原', note: '世界四大草原之一', photoUrls: [], stayDuration: 300 },
    { id: generateId(), type: 'restaurant', lat: 42.8800, lng: 83.7200, name: '巴音布鲁克', note: '九曲十八弯日落', photoUrls: [], stayDuration: 240 },
    { id: generateId(), type: 'attraction', lat: 42.6000, lng: 83.1500, name: '铁力买提达坂', note: '独库最高点附近', photoUrls: [], stayDuration: 60 },
    { id: generateId(), type: 'attraction', lat: 42.1600, lng: 82.9000, name: '大小龙池', note: '天山深处的翡翠', photoUrls: [], stayDuration: 90 },
    { id: generateId(), type: 'hotel', lat: 41.7100, lng: 83.0000, name: '库车大峡谷', note: '独库南起点，宿库车', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 41.7100, lng: 83.0000, name: '库车老城', note: '丝路重镇，龟兹故里', photoUrls: [], stayDuration: 180 }
  ];

  const silkRoadMarkers: MarkerData[] = [
    { id: generateId(), type: 'attraction', lat: 34.3416, lng: 108.9398, name: '西安·兵马俑', note: '丝绸之路起点', photoUrls: [], stayDuration: 240 },
    { id: generateId(), type: 'attraction', lat: 34.3600, lng: 108.9500, name: '西安·大雁塔', note: '千年古都', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'hotel', lat: 34.5800, lng: 105.7200, name: '天水·麦积山', note: '东方雕塑馆，宿天水', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'attraction', lat: 36.0600, lng: 103.8300, name: '兰州·中山桥', note: '黄河第一桥', photoUrls: [], stayDuration: 90 },
    { id: generateId(), type: 'restaurant', lat: 37.9300, lng: 102.6400, name: '武威·雷台汉墓', note: '马踏飞燕出土地', photoUrls: [], stayDuration: 120 },
    { id: generateId(), type: 'attraction', lat: 38.9300, lng: 100.4500, name: '张掖·马蹄寺', note: '悬崖上的石窟', photoUrls: [], stayDuration: 150 },
    { id: generateId(), type: 'hotel', lat: 39.7700, lng: 98.2900, name: '嘉峪关', note: '长城西起点，宿嘉峪关', photoUrls: [], stayDuration: 720 },
    { id: generateId(), type: 'gas', lat: 40.2900, lng: 95.5200, name: '瓜州加油站', note: '蜜瓜之乡', photoUrls: [], stayDuration: 30 },
    { id: generateId(), type: 'attraction', lat: 40.1400, lng: 94.6600, name: '敦煌·莫高窟', note: '丝路明珠，终点', photoUrls: [], stayDuration: 360 }
  ];

  return [
    {
      id: 'preset-sichuan-tibet',
      name: '川藏南线 G318',
      createdAt: now,
      updatedAt: now,
      markers: sichuanTibetMarkers,
      totalDistance: 2150,
      totalDuration: 0,
      fuelCost: 0,
      description: '中国人的景观大道，从天府之国到圣城拉萨，翻越14座4000米以上高山',
    },
    {
      id: 'preset-northwest-loop',
      name: '西北大环线',
      createdAt: now,
      updatedAt: now,
      markers: northwestLoopMarkers,
      totalDistance: 3200,
      totalDuration: 0,
      fuelCost: 0,
      description: '青海-甘肃经典环线，湖泊、盐湖、戈壁、石窟、丹霞一路尽览',
    },
    {
      id: 'preset-yunnan-loop',
      name: '云南滇西北环线',
      createdAt: now,
      updatedAt: now,
      markers: yunnanLoopMarkers,
      totalDistance: 1800,
      totalDuration: 0,
      fuelCost: 0,
      description: '昆明-大理-丽江-香格里拉-腾冲，风花雪月与民族风情之旅',
    },
    {
      id: 'preset-xinjiang-duku',
      name: '新疆独库公路',
      createdAt: now,
      updatedAt: now,
      markers: xinjiangDukuMarkers,
      totalDistance: 561,
      totalDuration: 0,
      fuelCost: 0,
      description: '纵贯天山脊梁的景观大道，一路四季，十里不同天（仅6-10月通车）',
    },
    {
      id: 'preset-silk-road',
      name: '丝绸之路·西安至敦煌',
      createdAt: now,
      updatedAt: now,
      markers: silkRoadMarkers,
      totalDistance: 1900,
      totalDuration: 0,
      fuelCost: 0,
      description: '千年丝路古道，从长安到敦煌，探寻河西走廊的历史印记',
    }
  ];
}

const PRESET_ROUTES = buildPresetRoutes();

export const MockAPI = {
  async getTile(z: number, x: number, y: number): Promise<TileResponse> {
    await delay(100 + Math.random() * 200);
    const tileUrl = `https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/${z}/${x}/${y}.png`;

    try {
      const cached = await StorageService.getTile(z, x, y);
      if (cached) {
        return {
          success: true,
          tileUrl: cached.url,
          fromCache: true
        };
      }
    } catch (e) {
      // Cache miss or error, fall through
    }

    return {
      success: true,
      tileUrl,
      fromCache: false
    };
  },

  async loadRoutes(): Promise<RouteData[]> {
    await delay(500);
    const storedRoutes = StorageService.loadRoutes();
    const allRoutes = [...PRESET_ROUTES, ...storedRoutes];
    return allRoutes;
  },

  async saveRoute(route: RouteData): Promise<{ success: boolean; id: string }> {
    await delay(300);
    const routes = StorageService.loadRoutes();
    const index = routes.findIndex(r => r.id === route.id);
    route.updatedAt = Date.now();
    if (index >= 0) {
      routes[index] = route;
    } else {
      routes.push(route);
    }
    StorageService.saveRoutes(routes);
    return { success: true, id: route.id };
  },

  async deleteRoute(id: string): Promise<boolean> {
    await delay(200);
    const routes = StorageService.loadRoutes();
    const filtered = routes.filter(r => r.id !== id);
    StorageService.saveRoutes(filtered);
    return filtered.length < routes.length;
  },

  async estimateDistance(from: [number, number], to: [number, number]): Promise<number> {
    await delay(150);
    return haversineDistance(from, to);
  },

  async getPresetRoutes(): Promise<RouteData[]> {
    await delay(300);
    return PRESET_ROUTES.map(r => ({ ...r }));
  }
};
