import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { getTemplate } from './index';

const InvoicePreview = forwardRef(function InvoicePreview({ doc, templateId }, paperRef) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const template = getTemplate(templateId);
  const { Component, width } = template;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const update = () => {
      const available = wrap.clientWidth;
      const s = Math.min(1, available / width);
      setScale(s);
      const paper = wrap.querySelector('#invoice-print');
      if (paper) setHeight(paper.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    const paper = wrap.querySelector('#invoice-print');
    if (paper) ro.observe(paper);
    return () => ro.disconnect();
  }, [width, templateId]);

  return (
    <div ref={wrapRef} className="w-full flex justify-center overflow-hidden" style={{ height: height || undefined }}>
      <div style={{ width, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <div id="invoice-print" ref={paperRef} className="shadow-2xl">
          <Component doc={doc} />
        </div>
      </div>
    </div>
  );
});

export default InvoicePreview;
