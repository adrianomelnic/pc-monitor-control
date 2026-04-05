import React from 'react';
import { SvgProps } from 'react-native-svg';
import SiAioCoolerV1 from '../../assets/icons/custom/aio-cooler-v1.svg';
import SiAioCoolerV2 from '../../assets/icons/custom/aio-cooler-v2.svg';
import SiAioCoolerV3 from '../../assets/icons/custom/aio-cooler-v3.svg';
import SiAioCoolerV4 from '../../assets/icons/custom/aio-cooler-v4.svg';
import SiCaseTowerV1 from '../../assets/icons/custom/case-tower-v1.svg';
import SiCaseTowerV2 from '../../assets/icons/custom/case-tower-v2.svg';
import SiCaseTowerV3 from '../../assets/icons/custom/case-tower-v3.svg';
import SiCoolantBottle from '../../assets/icons/custom/coolant-bottle.svg';
import SiCpuBlockAmdV1 from '../../assets/icons/custom/cpu-block-amd-v1.svg';
import SiCpuBlockAmdV3 from '../../assets/icons/custom/cpu-block-amd-v3.svg';
import SiCpuBlockIntelV1 from '../../assets/icons/custom/cpu-block-intel-v1.svg';
import SiCpuBlockIntelV2 from '../../assets/icons/custom/cpu-block-intel-v2.svg';
import SiCpuBlockThreadripper from '../../assets/icons/custom/cpu-block-threadripper.svg';
import SiCpuCoolerTowerV1 from '../../assets/icons/custom/cpu-cooler-tower-v1.svg';
import SiCpuCoolerTowerV3 from '../../assets/icons/custom/cpu-cooler-tower-v3.svg';
import SiCpuCoolerTowerV4 from '../../assets/icons/custom/cpu-cooler-tower-v4.svg';
import SiCpuGenericV1 from '../../assets/icons/custom/cpu-generic-v1.svg';
import SiCpuGenericV2 from '../../assets/icons/custom/cpu-generic-v2.svg';
import SiCpuRyzen from '../../assets/icons/custom/cpu-ryzen.svg';
import SiDistilledWater from '../../assets/icons/custom/distilled-water.svg';
import SiDistroPlateV1 from '../../assets/icons/custom/distro-plate-v1.svg';
import SiDistroPlateV3 from '../../assets/icons/custom/distro-plate-v3.svg';
import SiDistroPlateV4 from '../../assets/icons/custom/distro-plate-v4.svg';
import SiEarbudsV1 from '../../assets/icons/custom/earbuds-v1.svg';
import SiEarbudsV2 from '../../assets/icons/custom/earbuds-v2.svg';
import SiFan120mmV1 from '../../assets/icons/custom/fan-120mm-v1.svg';
import SiFan120mmV3 from '../../assets/icons/custom/fan-120mm-v3.svg';
import SiFan120mmV4 from '../../assets/icons/custom/fan-120mm-v4.svg';
import SiFan140mmV2 from '../../assets/icons/custom/fan-140mm-v2.svg';
import SiFan140mmV4 from '../../assets/icons/custom/fan-140mm-v4.svg';
import SiFillingBottle from '../../assets/icons/custom/filling-bottle.svg';
import SiFitting45deg from '../../assets/icons/custom/fitting-45deg.svg';
import SiFitting90deg from '../../assets/icons/custom/fitting-90deg.svg';
import SiFittingOffset from '../../assets/icons/custom/fitting-offset.svg';
import SiFittingStraight from '../../assets/icons/custom/fitting-straight.svg';
import SiFlowIndicatorV1 from '../../assets/icons/custom/flow-indicator-v1.svg';
import SiFlowIndicatorV2 from '../../assets/icons/custom/flow-indicator-v2.svg';
import SiGpuAmdV1 from '../../assets/icons/custom/gpu-amd-v1.svg';
import SiGpuAmdV2 from '../../assets/icons/custom/gpu-amd-v2.svg';
import SiGpuBackplateActiveV2 from '../../assets/icons/custom/gpu-backplate-active-v2.svg';
import SiGpuBackplatePassiveV1 from '../../assets/icons/custom/gpu-backplate-passive-v1.svg';
import SiGpuBlockActiveBackplateV4 from '../../assets/icons/custom/gpu-block-active-backplate-v4.svg';
import SiGpuBlockFounders from '../../assets/icons/custom/gpu-block-founders.svg';
import SiGpuBlockReferenceV1 from '../../assets/icons/custom/gpu-block-reference-v1.svg';
import SiGpuBlockReferenceV3 from '../../assets/icons/custom/gpu-block-reference-v3.svg';
import SiGpuLiquidCooledV2 from '../../assets/icons/custom/gpu-liquid-cooled-v2.svg';
import SiGpuLiquidCooledV4 from '../../assets/icons/custom/gpu-liquid-cooled-v4.svg';
import SiGpuReferenceV1 from '../../assets/icons/custom/gpu-reference-v1.svg';
import SiGpuReferenceV3 from '../../assets/icons/custom/gpu-reference-v3.svg';
import SiGraphicsTablet from '../../assets/icons/custom/graphics-tablet.svg';
import SiHardLineCutter from '../../assets/icons/custom/hard-line-cutter.svg';
import SiHddExternal from '../../assets/icons/custom/hdd-external.svg';
import SiHeadsetGamingV1 from '../../assets/icons/custom/headset-gaming-v1.svg';
import SiHeadsetGamingV2 from '../../assets/icons/custom/headset-gaming-v2.svg';
import SiKeyboardBasic from '../../assets/icons/custom/keyboard-basic.svg';
import SiKeyboardCompact from '../../assets/icons/custom/keyboard-compact.svg';
import SiKeyboardFull from '../../assets/icons/custom/keyboard-full.svg';
import SiKeyboardTkl from '../../assets/icons/custom/keyboard-tkl.svg';
import SiM2Pcie from '../../assets/icons/custom/m2-pcie.svg';
import SiMicBasic from '../../assets/icons/custom/mic-basic.svg';
import SiMicCondenserArm from '../../assets/icons/custom/mic-condenser-arm.svg';
import SiMicDeskV3 from '../../assets/icons/custom/mic-desk-v3.svg';
import SiMotherboardAtxV1 from '../../assets/icons/custom/motherboard-atx-v1.svg';
import SiMotherboardAtxV3 from '../../assets/icons/custom/motherboard-atx-v3.svg';
import SiMotherboardMicroAtx from '../../assets/icons/custom/motherboard-micro-atx.svg';
import SiMotherboardMiniItx from '../../assets/icons/custom/motherboard-mini-itx.svg';
import SiMotherboardWaterCooled from '../../assets/icons/custom/motherboard-water-cooled.svg';
import SiMouseBasic from '../../assets/icons/custom/mouse-basic.svg';
import SiMouseGaming from '../../assets/icons/custom/mouse-gaming.svg';
import SiPsuV4 from '../../assets/icons/custom/psu-v4.svg';
import SiPumpReservoirV1 from '../../assets/icons/custom/pump-reservoir-v1.svg';
import SiPumpReservoirV4 from '../../assets/icons/custom/pump-reservoir-v4.svg';
import SiRadiator120mm from '../../assets/icons/custom/radiator-120mm.svg';
import SiRadiator240mm from '../../assets/icons/custom/radiator-240mm.svg';
import SiRadiator360mm from '../../assets/icons/custom/radiator-360mm.svg';
import SiRamV1 from '../../assets/icons/custom/ram-v1.svg';
import SiRamV4 from '../../assets/icons/custom/ram-v4.svg';
import SiRamV8 from '../../assets/icons/custom/ram-v8.svg';
import SiSoftTubeCutter from '../../assets/icons/custom/soft-tube-cutter.svg';
import SiSsd from '../../assets/icons/custom/ssd.svg';
import SiTempFlowMonitor from '../../assets/icons/custom/temp-flow-monitor.svg';
import SiThermalPaste from '../../assets/icons/custom/thermal-paste.svg';
import SiTrackball from '../../assets/icons/custom/trackball.svg';
import SiWebcamV1 from '../../assets/icons/custom/webcam-v1.svg';
import SiWebcamV2 from '../../assets/icons/custom/webcam-v2.svg';
import SiWebcamV3 from '../../assets/icons/custom/webcam-v3.svg';
import SiWebcamV4 from '../../assets/icons/custom/webcam-v4.svg';
import SiWifiExtenderV1 from '../../assets/icons/custom/wifi-extender-v1.svg';
import SiWifiExtenderV2 from '../../assets/icons/custom/wifi-extender-v2.svg';

export type CustomIconName =
  | 'si:aio-cooler-v1'
  | 'si:aio-cooler-v2'
  | 'si:aio-cooler-v3'
  | 'si:aio-cooler-v4'
  | 'si:case-tower-v1'
  | 'si:case-tower-v2'
  | 'si:case-tower-v3'
  | 'si:coolant-bottle'
  | 'si:cpu-block-amd-v1'
  | 'si:cpu-block-amd-v3'
  | 'si:cpu-block-intel-v1'
  | 'si:cpu-block-intel-v2'
  | 'si:cpu-block-threadripper'
  | 'si:cpu-cooler-tower-v1'
  | 'si:cpu-cooler-tower-v3'
  | 'si:cpu-cooler-tower-v4'
  | 'si:cpu-generic-v1'
  | 'si:cpu-generic-v2'
  | 'si:cpu-ryzen'
  | 'si:distilled-water'
  | 'si:distro-plate-v1'
  | 'si:distro-plate-v3'
  | 'si:distro-plate-v4'
  | 'si:earbuds-v1'
  | 'si:earbuds-v2'
  | 'si:fan-120mm-v1'
  | 'si:fan-120mm-v3'
  | 'si:fan-120mm-v4'
  | 'si:fan-140mm-v2'
  | 'si:fan-140mm-v4'
  | 'si:filling-bottle'
  | 'si:fitting-45deg'
  | 'si:fitting-90deg'
  | 'si:fitting-offset'
  | 'si:fitting-straight'
  | 'si:flow-indicator-v1'
  | 'si:flow-indicator-v2'
  | 'si:gpu-amd-v1'
  | 'si:gpu-amd-v2'
  | 'si:gpu-backplate-active-v2'
  | 'si:gpu-backplate-passive-v1'
  | 'si:gpu-block-active-backplate-v4'
  | 'si:gpu-block-founders'
  | 'si:gpu-block-reference-v1'
  | 'si:gpu-block-reference-v3'
  | 'si:gpu-liquid-cooled-v2'
  | 'si:gpu-liquid-cooled-v4'
  | 'si:gpu-reference-v1'
  | 'si:gpu-reference-v3'
  | 'si:graphics-tablet'
  | 'si:hard-line-cutter'
  | 'si:hdd-external'
  | 'si:headset-gaming-v1'
  | 'si:headset-gaming-v2'
  | 'si:keyboard-basic'
  | 'si:keyboard-compact'
  | 'si:keyboard-full'
  | 'si:keyboard-tkl'
  | 'si:m2-pcie'
  | 'si:mic-basic'
  | 'si:mic-condenser-arm'
  | 'si:mic-desk-v3'
  | 'si:motherboard-atx-v1'
  | 'si:motherboard-atx-v3'
  | 'si:motherboard-micro-atx'
  | 'si:motherboard-mini-itx'
  | 'si:motherboard-water-cooled'
  | 'si:mouse-basic'
  | 'si:mouse-gaming'
  | 'si:psu-v4'
  | 'si:pump-reservoir-v1'
  | 'si:pump-reservoir-v4'
  | 'si:radiator-120mm'
  | 'si:radiator-240mm'
  | 'si:radiator-360mm'
  | 'si:ram-v1'
  | 'si:ram-v4'
  | 'si:ram-v8'
  | 'si:soft-tube-cutter'
  | 'si:ssd'
  | 'si:temp-flow-monitor'
  | 'si:thermal-paste'
  | 'si:trackball'
  | 'si:webcam-v1'
  | 'si:webcam-v2'
  | 'si:webcam-v3'
  | 'si:webcam-v4'
  | 'si:wifi-extender-v1'
  | 'si:wifi-extender-v2';

type SvgComponent = React.FC<SvgProps>;

const CUSTOM_ICON_MAP: Record<CustomIconName, SvgComponent> = {
  'si:aio-cooler-v1': SiAioCoolerV1,
  'si:aio-cooler-v2': SiAioCoolerV2,
  'si:aio-cooler-v3': SiAioCoolerV3,
  'si:aio-cooler-v4': SiAioCoolerV4,
  'si:case-tower-v1': SiCaseTowerV1,
  'si:case-tower-v2': SiCaseTowerV2,
  'si:case-tower-v3': SiCaseTowerV3,
  'si:coolant-bottle': SiCoolantBottle,
  'si:cpu-block-amd-v1': SiCpuBlockAmdV1,
  'si:cpu-block-amd-v3': SiCpuBlockAmdV3,
  'si:cpu-block-intel-v1': SiCpuBlockIntelV1,
  'si:cpu-block-intel-v2': SiCpuBlockIntelV2,
  'si:cpu-block-threadripper': SiCpuBlockThreadripper,
  'si:cpu-cooler-tower-v1': SiCpuCoolerTowerV1,
  'si:cpu-cooler-tower-v3': SiCpuCoolerTowerV3,
  'si:cpu-cooler-tower-v4': SiCpuCoolerTowerV4,
  'si:cpu-generic-v1': SiCpuGenericV1,
  'si:cpu-generic-v2': SiCpuGenericV2,
  'si:cpu-ryzen': SiCpuRyzen,
  'si:distilled-water': SiDistilledWater,
  'si:distro-plate-v1': SiDistroPlateV1,
  'si:distro-plate-v3': SiDistroPlateV3,
  'si:distro-plate-v4': SiDistroPlateV4,
  'si:earbuds-v1': SiEarbudsV1,
  'si:earbuds-v2': SiEarbudsV2,
  'si:fan-120mm-v1': SiFan120mmV1,
  'si:fan-120mm-v3': SiFan120mmV3,
  'si:fan-120mm-v4': SiFan120mmV4,
  'si:fan-140mm-v2': SiFan140mmV2,
  'si:fan-140mm-v4': SiFan140mmV4,
  'si:filling-bottle': SiFillingBottle,
  'si:fitting-45deg': SiFitting45deg,
  'si:fitting-90deg': SiFitting90deg,
  'si:fitting-offset': SiFittingOffset,
  'si:fitting-straight': SiFittingStraight,
  'si:flow-indicator-v1': SiFlowIndicatorV1,
  'si:flow-indicator-v2': SiFlowIndicatorV2,
  'si:gpu-amd-v1': SiGpuAmdV1,
  'si:gpu-amd-v2': SiGpuAmdV2,
  'si:gpu-backplate-active-v2': SiGpuBackplateActiveV2,
  'si:gpu-backplate-passive-v1': SiGpuBackplatePassiveV1,
  'si:gpu-block-active-backplate-v4': SiGpuBlockActiveBackplateV4,
  'si:gpu-block-founders': SiGpuBlockFounders,
  'si:gpu-block-reference-v1': SiGpuBlockReferenceV1,
  'si:gpu-block-reference-v3': SiGpuBlockReferenceV3,
  'si:gpu-liquid-cooled-v2': SiGpuLiquidCooledV2,
  'si:gpu-liquid-cooled-v4': SiGpuLiquidCooledV4,
  'si:gpu-reference-v1': SiGpuReferenceV1,
  'si:gpu-reference-v3': SiGpuReferenceV3,
  'si:graphics-tablet': SiGraphicsTablet,
  'si:hard-line-cutter': SiHardLineCutter,
  'si:hdd-external': SiHddExternal,
  'si:headset-gaming-v1': SiHeadsetGamingV1,
  'si:headset-gaming-v2': SiHeadsetGamingV2,
  'si:keyboard-basic': SiKeyboardBasic,
  'si:keyboard-compact': SiKeyboardCompact,
  'si:keyboard-full': SiKeyboardFull,
  'si:keyboard-tkl': SiKeyboardTkl,
  'si:m2-pcie': SiM2Pcie,
  'si:mic-basic': SiMicBasic,
  'si:mic-condenser-arm': SiMicCondenserArm,
  'si:mic-desk-v3': SiMicDeskV3,
  'si:motherboard-atx-v1': SiMotherboardAtxV1,
  'si:motherboard-atx-v3': SiMotherboardAtxV3,
  'si:motherboard-micro-atx': SiMotherboardMicroAtx,
  'si:motherboard-mini-itx': SiMotherboardMiniItx,
  'si:motherboard-water-cooled': SiMotherboardWaterCooled,
  'si:mouse-basic': SiMouseBasic,
  'si:mouse-gaming': SiMouseGaming,
  'si:psu-v4': SiPsuV4,
  'si:pump-reservoir-v1': SiPumpReservoirV1,
  'si:pump-reservoir-v4': SiPumpReservoirV4,
  'si:radiator-120mm': SiRadiator120mm,
  'si:radiator-240mm': SiRadiator240mm,
  'si:radiator-360mm': SiRadiator360mm,
  'si:ram-v1': SiRamV1,
  'si:ram-v4': SiRamV4,
  'si:ram-v8': SiRamV8,
  'si:soft-tube-cutter': SiSoftTubeCutter,
  'si:ssd': SiSsd,
  'si:temp-flow-monitor': SiTempFlowMonitor,
  'si:thermal-paste': SiThermalPaste,
  'si:trackball': SiTrackball,
  'si:webcam-v1': SiWebcamV1,
  'si:webcam-v2': SiWebcamV2,
  'si:webcam-v3': SiWebcamV3,
  'si:webcam-v4': SiWebcamV4,
  'si:wifi-extender-v1': SiWifiExtenderV1,
  'si:wifi-extender-v2': SiWifiExtenderV2,
};

export function renderCustomIcon(
  name: CustomIconName,
  size: number,
  color: string
): React.ReactElement | null {
  const Icon = CUSTOM_ICON_MAP[name];
  if (!Icon) return null;
  return React.createElement(Icon as any, { width: size, height: size, color, fill: color });
}

export const CUSTOM_ICON_GROUPS: { label: string; icons: CustomIconName[] }[] = [
  { label: 'Cases', icons: ['si:case-tower-v1', 'si:case-tower-v2', 'si:case-tower-v3'] },
  { label: 'Motherboards', icons: ['si:motherboard-atx-v1', 'si:motherboard-atx-v3', 'si:motherboard-micro-atx', 'si:motherboard-mini-itx', 'si:motherboard-water-cooled'] },
  { label: 'CPU', icons: ['si:cpu-generic-v1', 'si:cpu-generic-v2', 'si:cpu-ryzen'] },
  { label: 'CPU Blocks', icons: ['si:cpu-block-amd-v1', 'si:cpu-block-amd-v3', 'si:cpu-block-intel-v1', 'si:cpu-block-intel-v2', 'si:cpu-block-threadripper'] },
  { label: 'CPU Coolers', icons: ['si:cpu-cooler-tower-v1', 'si:cpu-cooler-tower-v3', 'si:cpu-cooler-tower-v4'] },
  { label: 'AIO Coolers', icons: ['si:aio-cooler-v1', 'si:aio-cooler-v2', 'si:aio-cooler-v3', 'si:aio-cooler-v4'] },
  { label: 'GPU', icons: ['si:gpu-amd-v1', 'si:gpu-amd-v2', 'si:gpu-reference-v1', 'si:gpu-reference-v3'] },
  { label: 'GPU Liquid', icons: ['si:gpu-backplate-active-v2', 'si:gpu-backplate-passive-v1', 'si:gpu-block-active-backplate-v4', 'si:gpu-block-founders', 'si:gpu-block-reference-v1', 'si:gpu-block-reference-v3', 'si:gpu-liquid-cooled-v2', 'si:gpu-liquid-cooled-v4'] },
  { label: 'RAM', icons: ['si:ram-v1', 'si:ram-v4', 'si:ram-v8'] },
  { label: 'Storage', icons: ['si:hdd-external', 'si:m2-pcie', 'si:ssd'] },
  { label: 'PSU', icons: ['si:psu-v4'] },
  { label: 'Case Fans', icons: ['si:fan-120mm-v1', 'si:fan-120mm-v3', 'si:fan-120mm-v4', 'si:fan-140mm-v2', 'si:fan-140mm-v4'] },
  { label: 'Radiators', icons: ['si:radiator-120mm', 'si:radiator-240mm', 'si:radiator-360mm'] },
  { label: 'Distro Plates', icons: ['si:distro-plate-v1', 'si:distro-plate-v3', 'si:distro-plate-v4'] },
  { label: 'Pump & Reservoir', icons: ['si:pump-reservoir-v1', 'si:pump-reservoir-v4'] },
  { label: 'Water Cooling', icons: ['si:coolant-bottle', 'si:distilled-water', 'si:filling-bottle', 'si:flow-indicator-v1', 'si:flow-indicator-v2', 'si:temp-flow-monitor'] },
  { label: 'Fittings', icons: ['si:fitting-45deg', 'si:fitting-90deg', 'si:fitting-offset', 'si:fitting-straight', 'si:hard-line-cutter', 'si:soft-tube-cutter', 'si:thermal-paste'] },
  { label: 'WiFi', icons: ['si:wifi-extender-v1', 'si:wifi-extender-v2'] },
  { label: 'Keyboards', icons: ['si:keyboard-basic', 'si:keyboard-compact', 'si:keyboard-full', 'si:keyboard-tkl'] },
  { label: 'Mice', icons: ['si:graphics-tablet', 'si:mouse-basic', 'si:mouse-gaming', 'si:trackball'] },
  { label: 'Headsets', icons: ['si:earbuds-v1', 'si:earbuds-v2', 'si:headset-gaming-v1', 'si:headset-gaming-v2'] },
  { label: 'Microphones', icons: ['si:mic-basic', 'si:mic-condenser-arm', 'si:mic-desk-v3'] },
  { label: 'Webcams', icons: ['si:webcam-v1', 'si:webcam-v2', 'si:webcam-v3', 'si:webcam-v4'] },
];
