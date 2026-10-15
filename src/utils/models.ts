import { VisionModelInfo, VisionModelId } from '../types';

export const VISION_MODELS: Record<VisionModelId, VisionModelInfo> = {
  'farai-fpn': {
    id: 'farai-fpn',
    name: "Farai's FPN-DomainNet",
    tagline: 'MSc Thesis Architecture · Small-Object & Domain Adaptive',
    architecture: 'Dual-Path FPN + Adversarial Domain Invariant Backbone',
    description: 'Custom convolutional feature pyramid network optimized for micro-scale target detection in aerial, drone, and extreme scale variance imagery.',
    latencyFactor: 0.85,
    confidenceBias: 0.04,
    smallObjectBonus: 2,
    supportsMasks: true,
  },
  yolov8x: {
    id: 'yolov8x',
    name: 'YOLOv8x Benchmark',
    tagline: 'Industry Standard One-Stage Detector',
    architecture: 'CSPDarknet53 + PANet + Anchor-Free Head',
    description: 'High-speed one-stage detector optimized for real-time video surveillance and autonomous driving.',
    latencyFactor: 1.0,
    confidenceBias: 0.0,
    smallObjectBonus: 0,
    supportsMasks: false,
  },
  'mask-rcnn': {
    id: 'mask-rcnn',
    name: 'Mask R-CNN (ResNet-50-FPN)',
    tagline: 'Two-Stage Instance Segmentation Pioneer',
    architecture: 'ResNet-50 Backbone + Region Proposal Network + FCN Mask Branch',
    description: 'High-precision two-stage visual perception engine producing pixel-exact polygonal instance boundaries.',
    latencyFactor: 1.45,
    confidenceBias: 0.02,
    smallObjectBonus: 1,
    supportsMasks: true,
  },
  retinanet: {
    id: 'retinanet',
    name: 'RetinaNet Focal Loss',
    tagline: 'Dense One-Stage Focal Loss Benchmark',
    architecture: 'ResNet-101 + FPN + Focal Loss Head',
    description: 'Engineered specifically to solve the extreme foreground-background class imbalance during dense detection.',
    latencyFactor: 1.15,
    confidenceBias: -0.02,
    smallObjectBonus: 0,
    supportsMasks: false,
  },
};

export const MODEL_LIST: VisionModelInfo[] = Object.values(VISION_MODELS);
