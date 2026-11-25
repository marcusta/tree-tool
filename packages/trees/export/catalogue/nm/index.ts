// Written by `bun run package -- catalogue`: every species' profile in this folder, by species id.
import type { ShaderProfile } from '../../profiles';
import pine from './pine.json';
import spruce from './spruce.json';
import juniper from './juniper.json';
import oak from './oak.json';
import birch from './birch.json';
import globeWillow from './globe-willow.json';
import weepingWillow from './weeping-willow.json';
import honeyMesquite from './honey-mesquite.json';
import velvetMesquite from './velvet-mesquite.json';

export const NM_CATALOGUE = {
    'pine': pine,
    'spruce': spruce,
    'juniper': juniper,
    'oak': oak,
    'birch': birch,
    'globe-willow': globeWillow,
    'weeping-willow': weepingWillow,
    'honey-mesquite': honeyMesquite,
    'velvet-mesquite': velvetMesquite,
} as unknown as Record<string, ShaderProfile>;
