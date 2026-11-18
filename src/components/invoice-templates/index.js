import {
  ClassicTemplate, PharmaTemplate, ModernTemplate, CorporateTemplate, ElegantTemplate,
  MinimalTemplate, ServiceTemplate, ChallanTemplate,
} from './A4Templates';
import { CompactTemplate, Thermal80Template, Thermal58Template } from './CompactTemplates';
import { PAPER } from './shared';

export const TEMPLATES = [
  { id: 'pharma', name: 'Pharma Wholesale', desc: 'Batch, Expiry, MRP, Free qty', paper: 'A4', width: PAPER.a4, Component: PharmaTemplate },
  { id: 'classic', name: 'Classic GST', desc: 'Bordered traditional GST bill', paper: 'A4', width: PAPER.a4, Component: ClassicTemplate },
  { id: 'modern', name: 'Modern Gradient', desc: 'Bold colour header', paper: 'A4', width: PAPER.a4, Component: ModernTemplate },
  { id: 'corporate', name: 'Corporate', desc: 'Clean business layout', paper: 'A4', width: PAPER.a4, Component: CorporateTemplate },
  { id: 'elegant', name: 'Elegant Serif', desc: 'Premium classic typography', paper: 'A4', width: PAPER.a4, Component: ElegantTemplate },
  { id: 'minimal', name: 'Minimal', desc: 'Lots of whitespace', paper: 'A4', width: PAPER.a4, Component: MinimalTemplate },
  { id: 'service', name: 'Service / Clinic', desc: 'For services & consultations', paper: 'A4', width: PAPER.a4, Component: ServiceTemplate },
  { id: 'challan', name: 'Delivery Challan', desc: 'Goods dispatch without prices', paper: 'A4', width: PAPER.a4, Component: ChallanTemplate },
  { id: 'compact', name: 'Retail A5', desc: 'Half page counter bill', paper: 'A5', width: PAPER.a5, Component: CompactTemplate },
  { id: 'thermal80', name: 'Thermal 80mm', desc: 'POS receipt printer', paper: '80mm', width: PAPER.t80, Component: Thermal80Template },
  { id: 'thermal58', name: 'Thermal 58mm', desc: 'Small POS / mobile printer', paper: '58mm', width: PAPER.t58, Component: Thermal58Template },
];

export const ACCENTS = ['#1e5bd6', '#0f9d58', '#0e7490', '#b91c1c', '#7c3aed', '#c2410c', '#111827'];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
