/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import { createClient } from '@supabase/supabase-js';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  Scale, 
  Users, 
  Plus, 
  Trash2, 
  Info, 
  ChevronRight, 
  LayoutDashboard,
  Map as MapIcon,
  BookOpen,
  History,
  Search,
  MapPin,
  Maximize2,
  Navigation,
  Loader2,
  Download,
  Save,
  Layers,
  TrendingUp,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  APIProvider, 
  Map, 
  useMap, 
  AdvancedMarker,
  Pin,
  MapControl,
  ControlPosition
} from '@vis.gl/react-google-maps';
import { cn } from './lib/utils';
import { HeirType, Gender, Heir, CalculationResult, LandPlot, ValueZone, AccessLine, LandType, SubPlot, Soulte, SoilType, SoilZone } from './types';
import { calculateInheritance } from './services/inheritanceService';

const COLORS = [
  '#166534', // Emerald Green
  '#1d4ed8', // Royal Blue
  '#b91c1c', // Ruby Red
  '#7c3aed', // Amethyst Purple
  '#ea580c', // Amber Orange
  '#0891b2', // Cyan
  '#4d7c0f', // Olive
  '#be185d', // Pink
  '#1e293b', // Slate
  '#a21caf', // Magenta
  '#fbbf24', // Amber/Yellow
  '#2dd4bf', // Teal
  '#818cf8', // Indigo
  '#f472b6', // Rose
  '#fb923c', // Orange
  '#4ade80', // Light Green
  '#60a5fa', // Sky Blue
  '#c084fc', // Purple
  '#f87171', // Red
  '#22d3ee', // Cyan
];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const SOIL_CONFIG = {
  [SoilType.TIRS]: { color: '#1a2e05', coefficient: 1.4, label: 'ترس (خصبة جداً)' },
  [SoilType.HAMRI]: { color: '#7c2d12', coefficient: 1.1, label: 'حمري (طينية حمراء)' },
  [SoilType.RMEL]: { color: '#d97706', coefficient: 0.9, label: 'رمل (رملية)' },
  [SoilType.ROCKY]: { color: '#4b5563', coefficient: 0.6, label: 'صخرية (قليلة القيمة)' },
};

// Polygon component for rendering
const Polygon: React.FC<{ 
  path: { lat: number, lng: number }[], 
  options?: google.maps.PolygonOptions,
  onClick?: (e: google.maps.PolyMouseEvent) => void 
}> = (props) => {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;
    const polygon = new google.maps.Polygon({
      paths: props.path,
      ...props.options,
      map
    });
    
    if (props.onClick) {
      polygon.addListener('click', props.onClick);
    }
    
    polygonRef.current = polygon;
    return () => {
      polygon.setMap(null);
    };
  }, [map, props.path, props.options]);

  return null;
};

const HEIR_TRANSLATIONS: Record<HeirType, string> = {
  [HeirType.SPOUSE]: "زوج/زوجة",
  [HeirType.SON]: "ابن",
  [HeirType.DAUGHTER]: "بنت",
  [HeirType.FATHER]: "أب",
  [HeirType.MOTHER]: "أم",
  [HeirType.FULL_BROTHER]: "أخ شقيق",
  [HeirType.FULL_SISTER]: "أخت شقيقة",
  [HeirType.PATERNAL_BROTHER]: "أخ لأب",
  [HeirType.PATERNAL_SISTER]: "أخت لأب",
  [HeirType.MATERNAL_BROTHER]: "أخ لأم",
  [HeirType.MATERNAL_SISTER]: "أخت لأم",
  [HeirType.GRANDFATHER]: "جد",
  [HeirType.GRANDMOTHER]: "جدة",
};

export default function App() {
  const [totalArea, setTotalArea] = useState<number>(0);
  const [totalWeightedArea, setTotalWeightedArea] = useState<number>(0);
  const [deceasedGender, setDeceasedGender] = useState<Gender>(Gender.MALE);
  const [heirs, setHeirs] = useState<Heir[]>([]);
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [valueZones, setValueZones] = useState<ValueZone[]>([]);
  const [accessLines, setAccessLines] = useState<AccessLine[]>([]);
  const [landType, setLandType] = useState<LandType>(LandType.AGRICULTURAL);
  const [activeTab, setActiveTab] = useState<'calculator' | 'map' | 'guide'>('calculator');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isDrawing, setIsDrawing] = useState<'plot' | 'zone' | 'road' | null>(null);
  const [currentPath, setCurrentPath] = useState<{ lat: number, lng: number }[]>([]);
  const [soultes, setSoultes] = useState<Soulte[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  const addHeir = (type: HeirType) => {
    setHeirs(prev => {
      const typeCount = prev.filter(h => h.type === type).length + 1;
      const arabicName = HEIR_TRANSLATIONS[type];
      
      return [...prev, { 
        id: Math.random().toString(36).substr(2, 9), 
        type, 
        count: 1,
        name: `${arabicName} ${typeCount}`,
        age: 0
      }];
    });
  };

  const removeHeir = (id: string) => {
    setHeirs(prev => prev.filter(h => h.id !== id));
  };

  const updateHeir = (id: string, updates: Partial<Heir>) => {
    setHeirs(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const removePlot = (id: string) => {
    const plot = plots.find(p => p.id === id);
    if (plot) {
      setTotalArea(prev => Math.max(0, prev - plot.area));
    }
    setPlots(prev => prev.filter(p => p.id !== id));
  };

  const calculateWeightedArea = (path: { lat: number, lng: number }[]) => {
    const plotPolygon = turf.polygon([path.map(p => [p.lng, p.lat]).concat([[path[0].lng, path[0].lat]])]);
    let weightedArea = 0;
    const totalPhysicalArea = turf.area(plotPolygon);

    if (valueZones.length === 0) return totalPhysicalArea;

    valueZones.forEach(zone => {
      const zonePolygon = turf.polygon([zone.path.map(p => [p.lng, p.lat]).concat([[zone.path[0].lng, zone.path[0].lat]])]);
      try {
        const intersection = turf.intersect(turf.featureCollection([plotPolygon, zonePolygon]));
        if (intersection) {
          const intersectionArea = turf.area(intersection);
          weightedArea += intersectionArea * zone.coefficient;
        }
      } catch (e) {
        console.error("Intersection error", e);
      }
    });

    // Handle areas not covered by any zone (default coefficient 1.0)
    // This is a simplification. A more accurate way would be to subtract all zone intersections from the plot.
    return weightedArea || totalPhysicalArea;
  };

  const [isDivisionIllegal, setIsDivisionIllegal] = useState(false);
  const [scaleWarningPlot, setScaleWarningPlot] = useState<LandPlot | null>(null);
  
  // Map Configuration
  const [mapTypeId, setMapTypeId] = useState<string>('hybrid');
  const [tilt, setTilt] = useState<number>(45);
  const [heading, setHeading] = useState<number>(0);
  const [showSoilLayer, setShowSoilLayer] = useState(false);
  const [soilZones, setSoilZones] = useState<SoilZone[]>([]);
  const [elevation, setElevation] = useState<number | null>(null);
  const [drawingArea, setDrawingArea] = useState<number>(0);
  const [guidedStep, setGuidedStep] = useState<number>(1); // 1: Road, 2: Land, 3: Zones/Buildings

  // Mock Soil Data for Morocco
  useEffect(() => {
    const mockSoilZones: SoilZone[] = [
      {
        id: 'soil-1',
        type: SoilType.TIRS,
        coefficient: 1.4,
        color: SOIL_CONFIG[SoilType.TIRS].color,
        path: [
          { lat: 31.795, lng: -7.095 },
          { lat: 31.800, lng: -7.095 },
          { lat: 31.800, lng: -7.090 },
          { lat: 31.795, lng: -7.090 },
        ]
      },
      {
        id: 'soil-2',
        type: SoilType.HAMRI,
        coefficient: 1.1,
        color: SOIL_CONFIG[SoilType.HAMRI].color,
        path: [
          { lat: 31.790, lng: -7.100 },
          { lat: 31.795, lng: -7.100 },
          { lat: 31.795, lng: -7.095 },
          { lat: 31.790, lng: -7.095 },
        ]
      }
    ];
    setSoilZones(mockSoilZones);
  }, []);

  const snapPoint = (point: { lat: number, lng: number }) => {
    const SNAP_THRESHOLD = 0.0005; // Roughly 50m
    
    // 1. Snap to existing plots
    for (const plot of plots) {
      for (const p of plot.path) {
        const dist = Math.sqrt(Math.pow(p.lat - point.lat, 2) + Math.pow(p.lng - point.lng, 2));
        if (dist < SNAP_THRESHOLD) return p;
      }
    }
    
    // 2. Snap to current path start
    if (currentPath.length > 0) {
      const start = currentPath[0];
      const dist = Math.sqrt(Math.pow(start.lat - point.lat, 2) + Math.pow(start.lng - point.lng, 2));
      if (dist < SNAP_THRESHOLD) return start;
    }

    return point;
  };

  const getElevation = (point: { lat: number, lng: number }) => {
    if (!window.google) return;
    const elevator = new google.maps.ElevationService();
    elevator.getElevationForLocations({
      locations: [point]
    }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setElevation(results[0].elevation);
      }
    });
  };

  useEffect(() => {
    if (currentPath.length >= 3 && isDrawing !== 'road') {
      const area = google.maps.geometry.spherical.computeArea(
        currentPath.map(p => new google.maps.LatLng(p.lat, p.lng))
      );
      setDrawingArea(area);
    } else {
      setDrawingArea(0);
    }
  }, [currentPath, isDrawing]);

  const finishDrawing = () => {
    if (currentPath.length < (isDrawing === 'road' ? 2 : 3)) {
      setIsDrawing(null);
      setCurrentPath([]);
      return;
    }

    // Self-intersection check for polygons
    if (isDrawing !== 'road') {
      const poly = turf.polygon([currentPath.map(p => [p.lng, p.lat]).concat([[currentPath[0].lng, currentPath[0].lat]])]);
      const kinks = turf.kinks(poly);
      if (kinks.features.length > 0) {
        alert('تنبيه: الشكل متداخل مع نفسه. يرجى تصحيح الرسم.');
        return;
      }
    }

    if (isDrawing === 'plot') {
      const area = google.maps.geometry.spherical.computeArea(
        currentPath.map(p => new google.maps.LatLng(p.lat, p.lng))
      );
      
      // Automatic Soil Detection
      let soilCoefficient = 1.0;
      const plotPoly = turf.polygon([currentPath.map(p => [p.lng, p.lat]).concat([[currentPath[0].lng, currentPath[0].lat]])]);
      const centroid = turf.centroid(plotPoly);
      
      soilZones.forEach(zone => {
        const zonePoly = turf.polygon([zone.path.map(p => [p.lng, p.lat]).concat([[zone.path[0].lng, zone.path[0].lat]])]);
        if (turf.booleanPointInPolygon(centroid, zonePoly)) {
          soilCoefficient = zone.coefficient;
        }
      });

      const weightedArea = calculateWeightedArea(currentPath) * soilCoefficient;

      const newPlot: LandPlot = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Plot ${plots.length + 1}`,
        area: Math.round(area),
        weightedArea: Math.round(weightedArea),
        path: currentPath,
        address: 'Custom Plot',
        landType: landType
      };

      if (area > 1000000) { // 100 Ha
        setScaleWarningPlot(newPlot);
      }

      setPlots(prev => [...prev, newPlot]);
      setTotalArea(prev => prev + Math.round(area));
      setTotalWeightedArea(prev => prev + Math.round(weightedArea));
      setGuidedStep(3); // Move to next step
    } else if (isDrawing === 'zone') {
      const newZone: ValueZone = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Zone ${valueZones.length + 1}`,
        coefficient: 1.2, // Default
        path: currentPath,
        color: COLORS[valueZones.length % COLORS.length]
      };
      setValueZones(prev => [...prev, newZone]);
    } else if (isDrawing === 'road') {
      const newRoad: AccessLine = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Road ${accessLines.length + 1}`,
        path: currentPath
      };
      setAccessLines(prev => [...prev, newRoad]);
      setGuidedStep(2); // Move to next step
    }

    setIsDrawing(null);
    setCurrentPath([]);
  };

  const divideLand = () => {
    if (results.length === 0 || plots.length === 0) return;
    setIsDivisionIllegal(false);

    // 1. Global Value Summation & Target Calculation
    const totalWeightedValue = plots.reduce((sum, p) => sum + p.weightedArea, 0);
    
    // Sort heirs by share size (Largest to Smallest)
    const sortedHeirs = [...results].sort((a, b) => b.shareDecimal - a.shareDecimal);
    
    // Prepare plots
    const availablePlots = plots.map(p => ({ 
      ...p, 
      subPlots: [] as SubPlot[],
      remainingWeightedArea: p.weightedArea,
      remainingArea: p.area,
      centroid: turf.centroid(turf.polygon([p.path.map(pt => [pt.lng, pt.lat]).concat([[p.path[0].lng, p.path[0].lat]])]))
    }));

    const newSoultes: Soulte[] = [];
    const finalPlots = [...availablePlots];

    // 2. Best Fit Allocation (Greedy with Proximity & Manual Assignment)
    sortedHeirs.forEach(heir => {
      let targetValue = heir.requiredWeightedArea;
      let heirParcels: SubPlot[] = [];

      while (targetValue > 0.1) {
        let bestPlotIdx = -1;
        
        // First check if this heir is manually assigned to a plot that still has space
        bestPlotIdx = finalPlots.findIndex(p => p.assignedHeirId === heir.heirId && p.remainingWeightedArea > 0.1);

        if (bestPlotIdx === -1) {
          let maxFit = -1;
          finalPlots.forEach((plot, idx) => {
            if (plot.remainingWeightedArea <= 0.1) return;
            // Skip plots manually assigned to someone else
            if (plot.assignedHeirId && plot.assignedHeirId !== heir.heirId) return;

            let fitScore = 0;
            if (plot.remainingWeightedArea >= targetValue) {
              fitScore = 1000 + (plot.remainingWeightedArea - targetValue);
            } else {
              fitScore = plot.remainingWeightedArea;
            }

            if (heirParcels.length > 0) {
              const lastParcelCentroid = turf.centroid(turf.polygon([heirParcels[heirParcels.length - 1].path.map(pt => [pt.lng, pt.lat]).concat([[heirParcels[heirParcels.length - 1].path[0].lng, heirParcels[heirParcels.length - 1].path[0].lat]])]));
              const distance = turf.distance(lastParcelCentroid, plot.centroid);
              fitScore -= distance * 100;
            }

            if (fitScore > maxFit) {
              maxFit = fitScore;
              bestPlotIdx = idx;
            }
          });
        }

        if (bestPlotIdx === -1) {
           // If still no plot, just take any available plot (even if assigned to someone else, as a last resort)
           bestPlotIdx = finalPlots.findIndex(p => p.remainingWeightedArea > 0.1);
        }

        if (bestPlotIdx === -1) break;

        const plot = finalPlots[bestPlotIdx];
        const amountToTake = Math.min(targetValue, plot.remainingWeightedArea);
        const shareOfPlot = amountToTake / plot.weightedArea;
        const physicalArea = plot.area * shareOfPlot;

        // 3. Spine-and-Rib Slicing (Road Frontage)
        const plotPolygon = turf.polygon([plot.path.map(pt => [pt.lng, pt.lat]).concat([[plot.path[0].lng, plot.path[0].lat]])]);
        
        let nearestRoad = null;
        let minDistance = Infinity;
        
        accessLines.forEach(road => {
          const roadLine = turf.lineString(road.path.map(pt => [pt.lng, pt.lat]));
          const dist = turf.pointToLineDistance(plot.centroid, roadLine);
          if (dist < minDistance) {
            minDistance = dist;
            nearestRoad = roadLine;
          }
        });

        const bbox = turf.bbox(plotPolygon);
        const minLng = bbox[0];
        const minLat = bbox[1];
        const maxLng = bbox[2];
        const maxLat = bbox[3];

        let sliceAxis: 'lng' | 'lat' = 'lat';
        if (nearestRoad) {
          const roadBbox = turf.bbox(nearestRoad);
          const roadWidth = roadBbox[2] - roadBbox[0];
          const roadHeight = roadBbox[3] - roadBbox[1];
          // If road is horizontal, we want vertical strips (everyone gets frontage)
          sliceAxis = roadWidth > roadHeight ? 'lat' : 'lng';
        }

        const startProgress = 1 - (plot.remainingWeightedArea / plot.weightedArea);
        const targetProgress = startProgress + shareOfPlot;

        let sliceBox;
        let subPath: { lat: number, lng: number }[] = [];
        if (sliceAxis === 'lat') {
          const lngRange = maxLng - minLng;
          const startLng = minLng + (lngRange * startProgress);
          const endLng = minLng + (lngRange * targetProgress);
          sliceBox = turf.polygon([[
            [startLng, minLat - 0.01],
            [endLng, minLat - 0.01],
            [endLng, maxLat + 0.01],
            [startLng, maxLat + 0.01],
            [startLng, minLat - 0.01]
          ]]);
        } else {
          const latRange = maxLat - minLat;
          const startLat = minLat + (latRange * startProgress);
          const endLat = minLat + (latRange * targetProgress);
          sliceBox = turf.polygon([[
            [minLng - 0.01, startLat],
            [maxLng + 0.01, startLat],
            [maxLng + 0.01, endLat],
            [minLng - 0.01, endLat],
            [minLng - 0.01, startLat]
          ]]);
        }

        const intersection = turf.intersect(turf.featureCollection([plotPolygon, sliceBox]));
        
        if (intersection && (intersection.geometry.type === 'Polygon' || intersection.geometry.type === 'MultiPolygon')) {
          const coords = intersection.geometry.type === 'Polygon' 
            ? intersection.geometry.coordinates[0] 
            : (intersection.geometry.coordinates[0] as any)[0];
            
          subPath = coords.map((c: any) => ({ lng: c[0], lat: c[1] }));
        }

        const parcel: SubPlot = {
          heirId: heir.heirId,
          heirType: heir.heirType,
          heirName: heir.heirName,
          path: subPath,
          color: COLORS[results.findIndex(r => r.heirId === heir.heirId) % COLORS.length],
          area: physicalArea,
          weightedArea: amountToTake,
          value: physicalArea * (plot.weightedArea / plot.area)
        };

        plot.subPlots!.push(parcel);
        heirParcels.push(parcel);
        
        plot.remainingWeightedArea -= amountToTake;
        plot.remainingArea -= physicalArea;
        targetValue -= amountToTake;
      }

      // 4. Law 34-94 Check & Soulte Calculation
      const totalPhysicalAreaReceived = heirParcels.reduce((sum, p) => sum + p.area, 0);
      const totalValueReceived = heirParcels.reduce((sum, p) => sum + p.value, 0);
      const entitledValue = heir.requiredWeightedArea;

      const diff = totalValueReceived - entitledValue;
      if (Math.abs(diff) > 1) {
        newSoultes.push({
          fromHeirId: diff > 0 ? heir.heirId : 'ESTATE',
          fromHeirName: diff > 0 ? heir.heirName : 'صندوق التركة',
          toHeirId: diff > 0 ? 'ESTATE' : heir.heirId,
          toHeirName: diff > 0 ? 'صندوق التركة' : heir.heirName,
          amount: Math.abs(diff) * 10,
          reason: diff > 0 ? 'تعويض عن زيادة في قيمة الأرض المستلمة' : 'تعويض عن نقص في قيمة الأرض المستلمة'
        });
      }

      const minThreshold = landType === LandType.AGRICULTURAL ? 50000 : 100; // 5Ha for Ag
      if (totalPhysicalAreaReceived < minThreshold && totalPhysicalAreaReceived > 0) {
        setIsDivisionIllegal(true);
        newSoultes.push({
          fromHeirId: 'SYSTEM',
          fromHeirName: 'تنبيه قانوني',
          toHeirId: heir.heirId,
          toHeirName: heir.heirName,
          amount: 0,
          reason: `تحذير: المساحة المستلمة (${(totalPhysicalAreaReceived / 10000).toFixed(2)} هكتار) أقل من الحد الأدنى القانوني (القانون 34-94).`
        });
      }
    });

    setPlots(finalPlots);
    setSoultes(newSoultes);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || !GOOGLE_MAPS_API_KEY) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery + ', Morocco' }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const location = results[0].geometry.location;
        mapRef.current?.panTo(location);
        mapRef.current?.setZoom(14);
      }
    });
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        mapRef.current?.panTo(pos);
        mapRef.current?.setZoom(15);
        setIsLocating(false);
      },
      () => setIsLocating(false)
    );
  };

  const results = useMemo(() => {
    return calculateInheritance(totalWeightedArea, deceasedGender, heirs);
  }, [totalWeightedArea, deceasedGender, heirs]);

  const exportToPDF = async () => {
    const element = document.getElementById('estate-plan-report');
    if (!element) return;

    try {
      const dataUrl = await toPng(element, { quality: 0.95, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Plan_de_Partage_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const chartData = useMemo(() => {
    return results.map(r => ({
      name: r.heirName,
      value: r.shareDecimal,
      area: r.requiredWeightedArea.toFixed(2)
    }));
  }, [results]);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geometry', 'geocoding']}>
      {/* Scale Warning Modal */}
      <AnimatePresence>
        {scaleWarningPlot && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1a1a1a]/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-[#166534]/10"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-[#1a1a1a] text-center mb-4">تنبيه: مساحة كبيرة جداً</h3>
              <p className="text-sm text-[#1a1a1a]/60 text-center leading-relaxed mb-8">
                لقد قمت برسم قطعة أرض تتجاوز 100 هكتار ({(scaleWarningPlot.area / 10000).toFixed(1)} هكتار). 
                يرجى التأكد من أن هذا هو الحجم المطلوب، حيث أن الحسابات قد تستغرق وقتاً أطول.
              </p>
              <button 
                onClick={() => setScaleWarningPlot(null)}
                className="w-full py-4 bg-[#166534] text-white rounded-2xl font-bold hover:bg-[#166534]/90 transition-all"
              >
                متابعة
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#fdfcf9] text-[#1a1a1a] font-sans selection:bg-[#166534]/10" dir="rtl">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#166534]/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#166534] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#166534]/20">
              <Scale size={24} />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight text-[#166534]">ميراث المغرب</h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[#166534]/60">حاسبة الميراث حسب المدونة</p>
            </div>
          </div>
          
          <div className="flex bg-[#f5f2ed] p-1 rounded-full">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={cn(
                "px-6 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === 'calculator' ? "bg-white text-[#166534] shadow-sm" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
              )}
            >
              الحاسبة
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={cn(
                "px-6 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === 'map' ? "bg-white text-[#166534] shadow-sm" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
              )}
            >
              الخريطة
            </button>
            <button 
              onClick={() => setActiveTab('guide')}
              className={cn(
                "px-6 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === 'guide' ? "bg-white text-[#166534] shadow-sm" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
              )}
            >
              الدليل القانوني
            </button>
          </div>
        </nav>

        <main id="estate-plan-report" className="max-w-7xl mx-auto p-6">
          {activeTab === 'calculator' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sidebar: Inputs */}
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-[#166534]/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <MapIcon size={18} className="text-[#166534]" />
                      <h2 className="font-serif text-lg font-semibold">تفاصيل الأرض</h2>
                    </div>
                    <button 
                      onClick={() => {
                        setTotalArea(1000);
                        setDeceasedGender(Gender.MALE);
                        setHeirs([]);
                        setPlots([]);
                      }}
                      className="text-[10px] uppercase tracking-wider font-bold text-[#166534]/40 hover:text-[#166534] transition-colors"
                    >
                      إعادة ضبط
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#f5f2ed] rounded-2xl">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#1a1a1a]/40">تصنيف العقار</p>
                        <p className="text-sm font-bold text-[#166534]">{landType === LandType.AGRICULTURAL ? "فلاحي" : "حضري"}</p>
                      </div>
                      <div className="flex bg-white p-1 rounded-xl">
                        <button 
                          onClick={() => setLandType(LandType.AGRICULTURAL)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                            landType === LandType.AGRICULTURAL ? "bg-[#166534] text-white" : "text-[#1a1a1a]/40"
                          )}
                        >
                          فلاحي
                        </button>
                        <button 
                          onClick={() => setLandType(LandType.URBAN)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                            landType === LandType.URBAN ? "bg-[#166534] text-white" : "text-[#1a1a1a]/40"
                          )}
                        >
                          حضري
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-bold text-[#1a1a1a]/40 mb-2 block">المساحة الإجمالية (م²)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={totalArea}
                          onChange={(e) => setTotalArea(Number(e.target.value))}
                          className="w-full bg-[#f5f2ed] border-none rounded-2xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-[#166534]/20 transition-all outline-none"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {plots.length > 0 && (
                            <span className="text-[8px] bg-[#166534] text-white px-2 py-0.5 rounded-full font-bold">مزامنة الخريطة</span>
                          )}
                          <span className="text-sm font-bold text-[#166534]/40">م²</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-bold text-[#1a1a1a]/40 mb-2 block">القيمة المرجحة (م² مكافئ)</label>
                      <div className="p-4 bg-[#166534]/5 border border-[#166534]/10 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-[#166534]" />
                          <span className="text-lg font-serif font-bold text-[#166534]">{totalWeightedArea.toLocaleString()}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#166534]/60 uppercase">المساواة نشطة</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-bold text-[#1a1a1a]/40 mb-2 block">جنس المتوفى</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setDeceasedGender(Gender.MALE)}
                          className={cn(
                            "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                            deceasedGender === Gender.MALE 
                              ? "bg-[#166534] border-[#166534] text-white" 
                              : "border-[#f5f2ed] text-[#1a1a1a]/60 hover:border-[#166534]/20"
                          )}
                        >
                          ذكر
                        </button>
                        <button 
                          onClick={() => setDeceasedGender(Gender.FEMALE)}
                          className={cn(
                            "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                            deceasedGender === Gender.FEMALE 
                              ? "bg-[#166534] border-[#166534] text-white" 
                              : "border-[#f5f2ed] text-[#1a1a1a]/60 hover:border-[#166534]/20"
                          )}
                        >
                          أنثى
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-[#166534]/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-[#166534]" />
                      <h2 className="font-serif text-lg font-semibold">الورثة</h2>
                    </div>
                    <div className="dropdown relative group">
                      <button className={cn(
                        "w-10 h-10 bg-[#166534]/10 text-[#166534] rounded-full flex items-center justify-center hover:bg-[#166534] hover:text-white transition-all btn-shiny",
                        heirs.length === 0 && "pulse-glow"
                      )}>
                        <Plus size={20} />
                      </button>
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#166534]/10 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        {Object.values(HeirType).map((type) => (
                          <button 
                            key={type}
                            onClick={() => addHeir(type)}
                            className="w-full px-4 py-2 text-right text-sm hover:bg-[#f5f2ed] transition-colors flex items-center justify-between"
                          >
                            {HEIR_TRANSLATIONS[type]}
                            <ChevronRight size={14} className="opacity-30" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {heirs.length === 0 ? (
                        <div className="text-center py-8 px-4 border-2 border-dashed border-[#f5f2ed] rounded-2xl">
                          <p className="text-sm text-[#1a1a1a]/40 italic">أضف الورثة لبدء الحساب</p>
                        </div>
                      ) : (
                        heirs.map((heir) => (
                          <motion.div 
                            key={heir.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col p-4 bg-[#f5f2ed] rounded-2xl group space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#166534]">{HEIR_TRANSLATIONS[heir.type]}</span>
                              <button 
                                onClick={() => removeHeir(heir.id)}
                                className="p-1 text-red-500/40 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] uppercase font-bold text-[#1a1a1a]/30 mb-1 block">الاسم</label>
                                <input 
                                  type="text" 
                                  value={heir.name}
                                  onChange={(e) => updateHeir(heir.id, { name: e.target.value })}
                                  className="w-full bg-white border-none rounded-lg px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-[#166534]/20"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] uppercase font-bold text-[#1a1a1a]/30 mb-1 block">العمر</label>
                                <input 
                                  type="number" 
                                  value={heir.age}
                                  onChange={(e) => updateHeir(heir.id, { age: Number(e.target.value) })}
                                  className="w-full bg-white border-none rounded-lg px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-[#166534]/20"
                                />
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>

              {/* Main Area: Results */}
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visualization */}
                  <section className="bg-white rounded-3xl p-6 shadow-sm border border-[#166534]/5 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-full h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-6">
                        <LayoutDashboard size={18} className="text-[#166534]" />
                        <h2 className="font-serif text-lg font-semibold">معاينة التقسيم</h2>
                      </div>
                      
                      <div className="flex-1 w-full min-h-[300px]">
                        {results.length > 0 ? (
                          <motion.div 
                            key={heirs.length}
                            initial={{ scale: 0.95, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="w-full h-full"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={5}
                                  dataKey="value"
                                  animationBegin={0}
                                  animationDuration={800}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ 
                                    borderRadius: '16px', 
                                    border: 'none', 
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                    fontFamily: 'Inter, sans-serif'
                                  }}
                                />
                                <Legend verticalAlign="bottom" height={36}/>
                              </PieChart>
                            </ResponsiveContainer>
                          </motion.div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center space-y-3">
                              <div className="w-16 h-16 bg-[#f5f2ed] rounded-full flex items-center justify-center mx-auto text-[#166534]/20">
                                <Scale size={32} />
                              </div>
                              <p className="text-sm text-[#1a1a1a]/40">لم يتم تحديد ورثة بعد</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Summary Stats */}
                  <section className="bg-[#166534] rounded-3xl p-8 text-white shadow-xl shadow-[#166534]/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-8 opacity-60">
                        <Info size={18} />
                        <h2 className="text-xs font-bold uppercase tracking-widest">ملخص سريع</h2>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <p className="text-sm opacity-60 mb-1">إجمالي مساحة الأرض</p>
                          <p className="text-4xl font-serif font-bold">
                            {totalArea >= 10000 ? (totalArea / 10000).toFixed(2) : totalArea.toLocaleString()} 
                            <span className="text-lg opacity-60"> {totalArea >= 10000 ? 'هكتار' : 'م²'}</span>
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm opacity-60 mb-1">إجمالي الورثة</p>
                          <p className="text-4xl font-serif font-bold">{heirs.length}</p>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                          <p className="text-xs italic opacity-60 leading-relaxed">
                            "يتم تقسيم الميراث وفقاً لمدونة الأسرة المغربية (الكتاب السادس)، التي تتبع الفقه المالكي."
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center gap-3 bg-white/10 p-4 rounded-2xl">
                      <BookOpen size={20} className="text-white/60" />
                      <p className="text-xs font-medium">تم التحقق وفقاً للمعايير القانونية المغربية 2024</p>
                    </div>
                  </section>
                </div>

                {/* Detailed Breakdown */}
                <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#166534]/5">
                  <div className="flex items-center gap-2 mb-8">
                    <History size={18} className="text-[#166534]" />
                    <h2 className="font-serif text-lg font-semibold">تفاصيل توزيع الحصص</h2>
                  </div>

                  <div className="space-y-4">
                    {results.length > 0 ? (
                      results.map((result, idx) => (
                        <div 
                          key={idx}
                          className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-[#f5f2ed] hover:border-[#166534]/20 transition-all group"
                        >
                          <div className="flex items-center gap-4 mb-4 md:mb-0">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                              {result.shareFraction}
                            </div>
                            <div>
                              <h3 className="font-bold text-[#1a1a1a] flex items-center gap-2">
                                {result.heirName}
                                <span className="text-[10px] bg-[#f5f2ed] px-2 py-0.5 rounded-full text-[#1a1a1a]/40 uppercase tracking-tighter">{HEIR_TRANSLATIONS[result.heirType]}</span>
                              </h3>
                              <p className="text-xs text-[#1a1a1a]/40 mt-0.5">{result.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-8 text-left">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-bold text-[#1a1a1a]/30 mb-1">النسبة المئوية</p>
                              <p className="font-mono font-bold text-[#166534]">{(result.shareDecimal * 100).toFixed(2)}%</p>
                            </div>
                            <div className="min-w-[120px]">
                              <p className="text-[10px] uppercase tracking-wider font-bold text-[#1a1a1a]/30 mb-1">حصة القيمة</p>
                              <p className="font-serif text-xl font-bold">{result.requiredWeightedArea.toLocaleString()} <span className="text-xs opacity-40">م² مكافئ</span></p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-[#1a1a1a]/30 italic">
                        لا توجد نتائج حسابية متاحة. يرجى إضافة الورثة في الشريط الجانبي.
                      </div>
                    )}
                  </div>
                </section>

                {/* Settlement Table & Legal Warnings */}
                {(soultes.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Settlement Table */}
                    <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#166534]/10">
                      <div className="flex items-center gap-2 mb-6">
                        <Scale size={18} className="text-[#166534]" />
                        <h2 className="font-serif text-lg font-semibold text-[#166534]">جدول التسوية (الصلح)</h2>
                      </div>
                      <div className="space-y-3">
                        {soultes.filter(s => s.amount > 0).map((soulte, idx) => (
                          <div key={idx} className="p-4 bg-[#f5f2ed] rounded-2xl flex items-center justify-between border border-[#166534]/5">
                            <div>
                              <p className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">أمر دفع</p>
                              <p className="text-sm font-medium text-[#1a1a1a]">
                                من <span className="font-bold">{soulte.fromHeirName}</span> إلى <span className="font-bold">{soulte.toHeirName}</span>
                              </p>
                              <p className="text-[10px] text-[#1a1a1a]/60 mt-1">{soulte.reason}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-serif font-bold text-[#166534]">{soulte.amount.toLocaleString()} درهم</p>
                              <p className="text-[10px] font-bold text-[#166534]/40">مبلغ التعويض</p>
                            </div>
                          </div>
                        ))}
                        {soultes.filter(s => s.amount > 0).length === 0 && (
                          <p className="text-xs text-[#1a1a1a]/40 italic text-center py-4">لا توجد تعويضات نقدية مطلوبة.</p>
                        )}
                      </div>
                    </section>

                    {/* Legal Warnings (Law 34-94) */}
                    <section className="bg-white rounded-3xl p-8 shadow-sm border border-amber-500/10">
                      <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle size={18} className="text-amber-500" />
                        <h2 className="font-serif text-lg font-semibold text-amber-500">تنبيهات قانونية (ظهير 34-94)</h2>
                      </div>
                      <div className="space-y-3">
                        {soultes.filter(s => s.amount === 0).map((warning, idx) => (
                          <div key={idx} className="p-4 bg-amber-50 rounded-2xl flex items-start gap-3 border border-amber-100">
                            <div className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</div>
                            <div>
                              <p className="text-xs font-bold text-amber-700">{warning.toHeirName}</p>
                              <p className="text-[10px] text-amber-600/80 leading-relaxed">{warning.reason}</p>
                              <p className="text-[9px] text-amber-500 mt-2 font-medium">يُنصح ببيع الحصة أو إجراء معاوضة لتجنب التفتيت الممنوع قانوناً.</p>
                            </div>
                          </div>
                        ))}
                        {soultes.filter(s => s.amount === 0).length === 0 && (
                          <div className="p-4 bg-emerald-50 rounded-2xl flex items-center gap-3 border border-emerald-100">
                            <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">✓</div>
                            <p className="text-[10px] text-emerald-700 font-medium">جميع الحصص الموزعة تحترم الحد الأدنى للمساحة القانونية.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {/* Export Button */}
                <div className="flex gap-4">
                  <button 
                    onClick={exportToPDF}
                    className="flex-1 py-4 bg-[#166534] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#166534]/20 hover:bg-[#166534]/90 transition-all btn-shiny"
                  >
                    <Download size={20} />
                    إنشاء تقرير PDF احترافي
                  </button>
                  <button className="px-6 py-4 bg-white border border-[#166534]/20 text-[#166534] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#166534]/5 transition-all">
                    <Save size={20} />
                    حفظ في قاعدة البيانات
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'map' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Map Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                  <section className="bg-white rounded-3xl p-6 shadow-sm border border-[#166534]/5">
                    <div className="flex items-center gap-2 mb-6">
                      <Search size={18} className="text-[#166534]" />
                      <h2 className="font-serif text-lg font-semibold">البحث عن الأرض</h2>
                    </div>
                    
                    <form onSubmit={handleSearch} className="relative mb-6">
                      <input 
                        type="text" 
                        placeholder="ابحث عن موقع في المغرب..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#f5f2ed] border-none rounded-2xl px-10 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#166534]/20 transition-all"
                      />
                      <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/30" />
                      <button type="submit" className="hidden">بحث</button>
                    </form>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-[#1a1a1a]/30">أدوات الرسم الاحترافية</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map(step => (
                            <div 
                              key={step} 
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-all",
                                guidedStep === step ? "bg-[#166534] w-3" : "bg-[#166534]/20"
                              )} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => setIsDrawing('road')}
                          disabled={!!isDrawing}
                          className={cn(
                            "w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all btn-shiny",
                            isDrawing === 'road' ? "bg-[#166534] text-white" : "bg-[#f5f2ed] text-[#166534] hover:bg-[#166534]/10",
                            guidedStep === 1 && "pulse-glow ring-2 ring-[#166534]/20"
                          )}
                        >
                          <Navigation size={18} />
                          {isDrawing === 'road' ? 'جاري رسم الطريق...' : '1. رسم طريق وصول'}
                        </button>

                        <button 
                          onClick={() => setIsDrawing('plot')}
                          disabled={!!isDrawing || guidedStep < 2}
                          className={cn(
                            "w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all btn-shiny",
                            isDrawing === 'plot' ? "bg-[#166534] text-white" : "bg-[#f5f2ed] text-[#166534] hover:bg-[#166534]/10",
                            guidedStep === 2 && "pulse-glow ring-2 ring-[#166534]/20",
                            guidedStep < 2 && "opacity-50 cursor-not-allowed grayscale"
                          )}
                        >
                          <MapPin size={18} />
                          {isDrawing === 'plot' ? 'جاري رسم القطعة...' : '2. رسم قطعة أرض'}
                        </button>

                        <button 
                          onClick={() => setIsDrawing('zone')}
                          disabled={!!isDrawing || guidedStep < 3}
                          className={cn(
                            "w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all btn-shiny",
                            isDrawing === 'zone' ? "bg-[#166534] text-white" : "bg-[#f5f2ed] text-[#166534] hover:bg-[#166534]/10",
                            guidedStep < 3 && "opacity-50 cursor-not-allowed grayscale"
                          )}
                        >
                          <Layers size={18} />
                          {isDrawing === 'zone' ? 'جاري رسم المنطقة...' : '3. رسم منطقة قيمة'}
                        </button>
                      </div>

                      {/* Value Zones List */}
                      {valueZones.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase font-bold text-[#166534]/60">مناطق القيمة</p>
                          {valueZones.map(zone => (
                            <div key={zone.id} className="p-3 bg-[#f5f2ed] rounded-xl flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                                  <span className="text-xs font-bold">{zone.name}</span>
                                </div>
                                <button onClick={() => setValueZones(prev => prev.filter(z => z.id !== zone.id))} className="text-red-500/40 hover:text-red-500"><Trash2 size={12}/></button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#166534]/60">المعامل:</span>
                                <input 
                                  type="number" 
                                  step="0.1"
                                  value={zone.coefficient}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setValueZones(prev => prev.map(z => z.id === zone.id ? { ...z, coefficient: val } : z));
                                  }}
                                  className="w-16 px-2 py-1 bg-white border border-[#166534]/10 rounded-lg text-[10px] font-bold text-[#166534]"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Access Roads List */}
                      {accessLines.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase font-bold text-[#166534]/60">طرق الوصول</p>
                          {accessLines.map(road => (
                            <div key={road.id} className="p-3 bg-[#f5f2ed] rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2 text-amber-600">
                                <Navigation size={12} />
                                <span className="text-xs font-bold">{road.name}</span>
                              </div>
                              <button onClick={() => setAccessLines(prev => prev.filter(r => r.id !== road.id))} className="text-red-500/40 hover:text-red-500"><Trash2 size={12}/></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {plots.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-[#f5f2ed] rounded-2xl">
                          <p className="text-xs text-[#1a1a1a]/40">انقر على "رسم قطعة أرض جديدة" للبدء</p>
                        </div>
                      ) : (
                        plots.map(plot => (
                          <div key={plot.id} className="p-4 bg-[#f5f2ed] rounded-2xl group border border-[#166534]/5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[#166534] rounded-full" />
                                <h3 className="text-sm font-bold text-[#166534]">{plot.name}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#166534]/60">
                                  {(plot.area / 10000).toFixed(2)} هكتار
                                </span>
                                <button onClick={() => removePlot(plot.id)} className="text-red-500/40 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Maximize2 size={12} className="text-[#166534]/40" />
                                <span className="text-xs font-bold text-[#1a1a1a]">{plot.area.toLocaleString()} م² <span className="text-[10px] font-normal text-[#1a1a1a]/40">(المساحة الإجمالية)</span></span>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-[#166534]/5">
                              <p className="text-[9px] uppercase font-bold text-[#166534]/60">تخصيص يدوي (اختياري)</p>
                              <select 
                                value={plot.assignedHeirId || ''}
                                onChange={(e) => {
                                  const heirId = e.target.value || undefined;
                                  setPlots(prev => prev.map(p => p.id === plot.id ? { ...p, assignedHeirId: heirId } : p));
                                }}
                                className="w-full px-3 py-2 bg-white border border-[#166534]/10 rounded-xl text-[10px] font-bold text-[#166534] focus:outline-none focus:ring-2 focus:ring-[#166534]/20"
                              >
                                <option value="">تلقائي (حسب الخوارزمية)</option>
                                {results.map(heir => (
                                  <option key={heir.heirId} value={heir.heirId}>{heir.heirName}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="bg-[#166534] rounded-3xl p-6 text-white shadow-xl shadow-[#166534]/20">
                    <h3 className="font-serif text-lg font-bold mb-4">التقسيم التلقائي</h3>
                    {isDivisionIllegal && (
                      <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-200 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-red-100 leading-tight">
                          تحذير: التقسيم الحالي يخالف القانون 34-94 (تجزئة مفرطة). يوصى بالملكية المشتركة (الشياع) أو التعويض النقدي.
                        </p>
                      </div>
                    )}
                    <p className="text-xs opacity-70 leading-relaxed mb-6">
                      يتم تقسيم الأرض تلقائياً بناءً على قائمة الورثة.
                      يضمن النظام توزيعاً عادلاً وفقاً للمدونة.
                    </p>
                    
                    <button 
                      onClick={divideLand}
                      disabled={plots.length === 0 || heirs.length === 0}
                      className="w-full py-3 bg-white text-[#166534] rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-50 mb-6"
                    >
                      <Scale size={18} />
                      قسم الأرض الآن
                    </button>

                    <div className="space-y-3">
                      {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] bg-white/10 p-2 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-bold">{r.heirName}</span>
                          </div>
                          <span className="font-mono">{r.requiredWeightedArea.toFixed(1)} م² مكافئ</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Map View */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-2 shadow-sm border border-[#166534]/5 min-h-[600px] overflow-hidden relative">
                  {!GOOGLE_MAPS_API_KEY ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#f5f2ed] rounded-2xl">
                      <div className="text-center space-y-4 max-w-md px-6">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-[#166534]">
                          <MapIcon size={32} />
                        </div>
                        <h3 className="font-serif text-xl font-bold">Map Key Required</h3>
                        <p className="text-sm text-[#1a1a1a]/60">
                          To use the map feature, please add your Google Maps API Key to the project secrets as <code>VITE_GOOGLE_MAPS_API_KEY</code>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative">
                      <Map
                        style={{ width: '100%', height: '100%', borderRadius: '20px' }}
                        defaultCenter={{ lat: 31.7917, lng: -7.0926 }} // Center of Morocco
                        defaultZoom={15}
                        gestureHandling={'greedy'}
                        disableDefaultUI={true}
                        mapTypeId={mapTypeId}
                        tilt={tilt}
                        heading={heading}
                        onLoad={(map) => {
                          mapRef.current = map;
                        }}
                        onClick={(e) => {
                          if (isDrawing && e.detail.latLng) {
                            const snapped = snapPoint(e.detail.latLng);
                            setCurrentPath(prev => [...prev, snapped]);
                            getElevation(snapped);
                          }
                        }}
                        mapId="mirath_morocco_map"
                      >
                        {/* Soil Layer Overlay */}
                        {showSoilLayer && soilZones.map(zone => (
                          <Polygon 
                            key={zone.id}
                            path={zone.path}
                            options={{
                              fillColor: zone.color,
                              fillOpacity: 0.2,
                              strokeColor: zone.color,
                              strokeWeight: 1,
                              strokeDasharray: '2,2'
                            }}
                          />
                        ))}

                        {/* Render current drawing path */}
                        {currentPath.length > 0 && (
                          <Polygon 
                            path={currentPath}
                            options={{
                              fillColor: '#1a1a1a',
                              fillOpacity: 0.1,
                              strokeColor: '#1a1a1a',
                              strokeWeight: 1,
                              strokeDasharray: '5,5'
                            }}
                          />
                        )}

                        {/* Render Value Zones */}
                        {valueZones.map(zone => (
                          <Polygon 
                            key={zone.id}
                            path={zone.path}
                            options={{
                              fillColor: zone.color,
                              fillOpacity: 0.3,
                              strokeColor: zone.color,
                              strokeWeight: 1,
                            }}
                          />
                        ))}

                        {/* Render Access Lines */}
                        {accessLines.map(road => (
                          <Polygon 
                            key={road.id}
                            path={road.path}
                            options={{
                              strokeColor: '#f59e0b',
                              strokeWeight: 4,
                              fillOpacity: 0
                            }}
                          />
                        ))}

                        {/* Render existing plots */}
                        {plots.map(plot => (
                          <React.Fragment key={plot.id}>
                            <Polygon 
                              path={plot.path} 
                              options={{
                                fillColor: '#166534',
                                fillOpacity: 0.2,
                                strokeColor: '#166534',
                                strokeWeight: 2,
                              }}
                            />
                            {/* Render sub-plots if divided */}
                            {plot.subPlots?.map((sub, sIdx) => {
                              const subPolygon = turf.polygon([sub.path.map(p => [p.lng, p.lat]).concat([[sub.path[0].lng, sub.path[0].lat]])]);
                              const centroid = turf.centroid(subPolygon);
                              const center = { lng: centroid.geometry.coordinates[0], lat: centroid.geometry.coordinates[1] };

                              return (
                                <React.Fragment key={`${plot.id}-sub-${sIdx}`}>
                                  <Polygon 
                                    path={sub.path}
                                    options={{
                                      fillColor: sub.color,
                                      fillOpacity: 0.7,
                                      strokeColor: '#ffffff',
                                      strokeWeight: 2,
                                    }}
                                  />
                                  <AdvancedMarker position={center}>
                                    <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-lg border border-[#166534]/20 flex flex-col items-center">
                                      <span className="text-[8px] font-bold text-[#166534] whitespace-nowrap">{sub.heirName}</span>
                                      <span className="text-[7px] font-mono text-[#1a1a1a]/60">{sub.area.toFixed(1)}m²</span>
                                    </div>
                                  </AdvancedMarker>
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        ))}

                        {/* Render current path being drawn */}
                        {isDrawing && currentPath.length > 0 && (
                          <>
                            <Polygon 
                              path={currentPath}
                              options={{
                                fillColor: '#166534',
                                fillOpacity: 0.1,
                                strokeColor: '#166534',
                                strokeWeight: 2,
                                strokeOpacity: 0.5
                              }}
                            />
                            {currentPath.map((point, idx) => (
                              <AdvancedMarker key={idx} position={point}>
                                <div className="w-2 h-2 bg-[#166534] rounded-full border border-white" />
                              </AdvancedMarker>
                            ))}
                            
                            {/* Real-time Area Badge */}
                            {currentPath.length >= 3 && isDrawing !== 'road' && (
                              <AdvancedMarker position={currentPath[currentPath.length - 1]}>
                                <div className="bg-[#166534] text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-xl translate-y-[-30px]">
                                  {drawingArea >= 10000 ? (drawingArea / 10000).toFixed(2) + ' Ha' : Math.round(drawingArea) + ' m²'}
                                </div>
                              </AdvancedMarker>
                            )}
                          </>
                        )}
                      </Map>
                      
                      {/* Layer Switcher & Map Controls */}
                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <div className="bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-[#166534]/10 flex flex-col gap-1">
                          <button 
                            onClick={() => setMapTypeId('roadmap')}
                            className={cn("p-2 rounded-xl transition-all", mapTypeId === 'roadmap' ? "bg-[#166534] text-white" : "hover:bg-[#f5f2ed] text-[#166534]")}
                            title="Roadmap"
                          >
                            <MapIcon size={18} />
                          </button>
                          <button 
                            onClick={() => setMapTypeId('hybrid')}
                            className={cn("p-2 rounded-xl transition-all", mapTypeId === 'hybrid' ? "bg-[#166534] text-white" : "hover:bg-[#f5f2ed] text-[#166534]")}
                            title="Satellite"
                          >
                            <Layers size={18} />
                          </button>
                          <div className="h-px bg-[#166534]/10 mx-2" />
                          <button 
                            onClick={() => setShowSoilLayer(!showSoilLayer)}
                            className={cn("p-2 rounded-xl transition-all", showSoilLayer ? "bg-amber-600 text-white" : "hover:bg-[#f5f2ed] text-amber-600")}
                            title="Soil Layer"
                          >
                            <TrendingUp size={18} />
                          </button>
                        </div>

                        <div className="bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-[#166534]/10 flex flex-col gap-1">
                          <button 
                            onClick={() => setTilt(tilt === 0 ? 45 : 0)}
                            className={cn("p-2 rounded-xl transition-all", tilt > 0 ? "bg-[#166534] text-white" : "hover:bg-[#f5f2ed] text-[#166534]")}
                            title="3D Tilt"
                          >
                            <Maximize2 size={18} />
                          </button>
                          <button 
                            onClick={() => setHeading((heading + 90) % 360)}
                            className="p-2 rounded-xl hover:bg-[#f5f2ed] text-[#166534] transition-all"
                            title="Rotate"
                          >
                            <Navigation size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Elevation Display */}
                      {elevation !== null && (
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-[#166534]/10 flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-bold text-[#1a1a1a]">الارتفاع: {elevation.toFixed(1)} متر</span>
                        </div>
                      )}

                      {/* Soil Legend */}
                      {showSoilLayer && (
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-amber-600/20 flex flex-col gap-2 max-w-[150px]">
                          <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">أنواع التربة</p>
                          {Object.entries(SOIL_CONFIG).map(([type, config]) => (
                            <div key={type} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                              <span className="text-[9px] font-medium text-[#1a1a1a]">{config.label}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Drawing Controls */}
                      {isDrawing && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur-md p-2 rounded-3xl shadow-2xl border border-[#166534]/20">
                          <div className="px-4 py-2 border-r border-[#166534]/10">
                            <p className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">جاري الرسم</p>
                            <p className="text-xs font-medium text-[#1a1a1a]">
                              {isDrawing === 'road' ? 'طريق وصول' : isDrawing === 'plot' ? 'قطعة أرض' : 'منطقة قيمة'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 px-2">
                            <button 
                              onClick={() => setCurrentPath(prev => prev.slice(0, -1))}
                              className="p-2 hover:bg-[#f5f2ed] text-[#1a1a1a]/60 rounded-xl transition-all"
                              title="Undo last point"
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                if (currentPath.length > 0) {
                                  setCurrentPath(prev => [...prev, prev[0]]);
                                }
                              }}
                              className="p-2 hover:bg-[#f5f2ed] text-[#166534] rounded-xl transition-all"
                              title="Close Polygon"
                            >
                              <Maximize2 size={18} />
                            </button>
                          </div>

                          <button 
                            onClick={finishDrawing}
                            className="bg-[#166534] text-white px-6 py-2 rounded-2xl font-bold text-sm shadow-lg shadow-[#166534]/20 hover:bg-[#166534]/90 transition-all"
                          >
                            إنهاء الرسم
                          </button>
                          <button 
                            onClick={() => {
                              setIsDrawing(null);
                              setCurrentPath([]);
                            }}
                            className="bg-red-500 text-white p-2 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}

                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <button 
                          onClick={locateMe}
                          disabled={isLocating}
                          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-[#166534] hover:bg-[#166534] hover:text-white transition-all disabled:opacity-50"
                        >
                          {isLocating ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                        </button>
                      </div>

                      {isDrawing && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
                          <button 
                            onClick={finishDrawing}
                            className="px-6 py-2 bg-[#166534] text-white rounded-full shadow-xl font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all"
                          >
                            إنهاء الرسم
                          </button>
                          <button 
                            onClick={() => {
                              setIsDrawing(null);
                              setCurrentPath([]);
                            }}
                            className="px-6 py-2 bg-white text-red-500 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all"
                          >
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
                    <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl p-4 pointer-events-auto border border-[#166534]/10">
                      <p className="text-[10px] font-bold text-[#166534] uppercase tracking-widest mb-1">تعليمات الخريطة</p>
                      <p className="text-[9px] text-[#1a1a1a]/60">انقر في أي مكان على الخريطة لتحديد قطعة أرض.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="font-serif text-4xl font-bold text-[#166534]">الميراث في القانون المغربي</h2>
                <p className="text-[#1a1a1a]/60 max-w-2xl mx-auto">
                  توفر مدونة الأسرة المغربية (الكتاب السادس) إطاراً شاملاً للميراث، مما يضمن العدالة بناءً على المبادئ الإسلامية.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-[#166534]/10 shadow-sm">
                  <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-[#166534]/10 rounded-lg flex items-center justify-center text-[#166534] text-sm">01</span>
                    نصيب الزوجين
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/70 leading-relaxed">
                    يأخذ الزوج النصف إذا لم يكن هناك فرع وارث، والربع إذا وجد.
                    تأخذ الزوجة (أو الزوجات مجتمعات) الربع إذا لم يكن هناك فرع وارث، والثمن إذا وجد.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-[#166534]/10 shadow-sm">
                  <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-[#166534]/10 rounded-lg flex items-center justify-center text-[#166534] text-sm">02</span>
                    نصيب الأبوين
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/70 leading-relaxed">
                    يأخذ كل من الأبوين السدس إذا كان للمتوفى فرع وارث.
                    إذا لم يوجد فرع وارث، تأخذ الأم الثلث، ويأخذ الأب الباقي بالتعصيب.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-[#166534]/10 shadow-sm">
                  <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-[#166534]/10 rounded-lg flex items-center justify-center text-[#166534] text-sm">03</span>
                    تعصيب الأبناء
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/70 leading-relaxed">
                    الأبناء هم ورثة بالتعصيب. يأخذ الذكر مثل حظ الأنثيين (نسبة 2:1).
                    إذا وجد بنات فقط ولا يوجد ابن، يأخذن فروضاً محددة (النصف للواحدة، والثلثان للمتعددات).
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-[#166534]/10 shadow-sm">
                  <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-[#166534]/10 rounded-lg flex items-center justify-center text-[#166534] text-sm">04</span>
                    خصوصية الأراضي
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/70 leading-relaxed">
                    في المغرب، يتبع ميراث الأراضي نفس القواعد الكسرية.
                    يقوم هذا التطبيق بحساب المساحة الدقيقة بالمتر المربع (م²) التي يحق لكل وارث الحصول عليها، مما يساعد في منع النزاعات.
                  </p>
                </div>
              </div>

              <div className="bg-[#166534]/5 p-8 rounded-3xl border border-[#166534]/10 text-center">
                <p className="text-sm font-medium text-[#166534]">
                  ملاحظة: هذه الأداة للأغراض المعلوماتية فقط. للإجراءات القانونية الرسمية، يرجى استشارة عدل معتمد أو المحكمة المغربية.
                </p>
              </div>
            </motion.div>
          )}
        </main>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#166534]/5 mt-12 text-center">
          <p className="text-xs text-[#1a1a1a]/40 font-medium uppercase tracking-[0.2em]">
            صُنع من أجل العدل والسلام في تقسيم الأراضي • المغرب 2026
          </p>
        </footer>
      </div>
    </APIProvider>
  );
}
