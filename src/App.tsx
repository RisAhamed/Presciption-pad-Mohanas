import { useEffect, useRef } from 'react';
import './App.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function App() {
    const billRef = useRef<HTMLDivElement>(null);

    const autoResizeInput = (input: HTMLInputElement) => {
        // Create a hidden measurer span that mimics the input's font
        const measurer = document.createElement('span');
        measurer.style.cssText = `
            visibility: hidden;
            position: absolute;
            white-space: pre;
            font-size: ${getComputedStyle(input).fontSize};
            font-family: ${getComputedStyle(input).fontFamily};
            font-weight: ${getComputedStyle(input).fontWeight};
            letter-spacing: ${getComputedStyle(input).letterSpacing};
        `;
        measurer.textContent = input.value || input.placeholder;
        document.body.appendChild(measurer);
        const width = measurer.getBoundingClientRect().width;
        document.body.removeChild(measurer);
        input.style.width = `${Math.max(80, Math.ceil(width) + 10)}px`;
    };

    const getBase64Image = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.95));
                } else {
                    resolve(url);
                }
            };
            img.onerror = () => resolve(url);
            img.src = url + '?t=' + Date.now();
        });
    };

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('billDate') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = today;
        }
        const nameInput = document.getElementById('patientName') as HTMLInputElement;
        if (nameInput) autoResizeInput(nameInput);
    }, []);

    const updateEmptyRowClasses = () => {
        for (let i = 1; i <= 10; i++) {
            const row = document.getElementById(`procedure-row-${i}`);
            const nameInput = document.getElementById(`proc${i}Name`) as HTMLInputElement | null;
            const dateInput = document.getElementById(`proc${i}Date`) as HTMLInputElement | null;
            if (!row) continue;
            const nameEmpty = !nameInput?.value?.trim();
            const dateEmpty = !dateInput?.value?.trim();
            if (nameEmpty && dateEmpty) {
                row.classList.add('row-empty');
            } else {
                row.classList.remove('row-empty');
            }
        }
    };

    const handlePrint = () => {
        updateEmptyRowClasses();
        window.print();
    };

    const downloadPDF = async () => {
        const bill = billRef.current;
        if (!bill) return;

        const billNo = (document.getElementById('billNo') as HTMLInputElement)?.value || 'New';
        const rawDate = (document.getElementById('billDate') as HTMLInputElement)?.value || '';
        const date = rawDate ? rawDate.split('-').reverse().join('-') : 'Date';

        // ─── Track injected spans / hidden inputs for cleanup ───
        const allProcRows: HTMLElement[] = [];
        const rowWasHidden: boolean[] = [];
        let logoImg: HTMLImageElement | null = null;
        let origLogoSrc = '';
        let billDateInput: HTMLInputElement | null = null;
        const procDateInputs: HTMLInputElement[] = [];
        const procFormattedSpans: HTMLSpanElement[] = [];

        // ─── Inject formatted bill-date span ───
        billDateInput = document.getElementById('billDate') as HTMLInputElement | null;
        const formattedSpan = document.createElement('span');
        formattedSpan.id = 'billDateFormatted';
        formattedSpan.style.cssText = 'font-size:inherit;color:inherit;font-family:inherit;';
        formattedSpan.textContent = date;
        if (billDateInput?.parentNode) {
            billDateInput.parentNode.insertBefore(formattedSpan, billDateInput.nextSibling);
            billDateInput.style.display = 'none';
        }

        // ─── Inject formatted procedure-date spans ───
        for (let i = 1; i <= 10; i++) {
            const procDateInput = document.getElementById(`proc${i}Date`) as HTMLInputElement | null;
            if (!procDateInput) continue;
            const rawProcDate = procDateInput.value || '';
            if (!rawProcDate) {
                procDateInputs.push(procDateInput);
                procFormattedSpans.push(document.createElement('span'));
                continue;
            }
            const formattedProcDate = rawProcDate.split('-').reverse().join('-');
            const procSpan = document.createElement('span');
            procSpan.className = 'proc-date-formatted';
            procSpan.style.cssText = 'font-size:inherit;color:inherit;font-family:inherit;font-weight:inherit;';
            procSpan.textContent = formattedProcDate;
            procDateInput.parentNode?.insertBefore(procSpan, procDateInput.nextSibling);
            procDateInput.style.display = 'none';
            procDateInputs.push(procDateInput);
            procFormattedSpans.push(procSpan);
        }

        // ─── Convert logo to base64 ───
        logoImg = bill.querySelector('.clinic-logo') as HTMLImageElement | null;
        origLogoSrc = logoImg?.src || '';
        if (logoImg) {
            const base64src = await getBase64Image('/logo.jpeg');
            logoImg.src = base64src;
            await new Promise<void>((resolve) => {
                if (logoImg!.complete) { resolve(); return; }
                logoImg!.onload = () => resolve();
                logoImg!.onerror = () => resolve();
            });
        }

        // ─── Wait for all images ───
        const images = Array.from(bill.querySelectorAll('img'));
        await Promise.all(images.map((img) => new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) { resolve(); return; }
            img.onload = () => resolve();
            img.onerror = () => resolve();
        })));

        window.scrollTo(0, 0);

        // ─── Hide toolbar ───
        const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
        const origToolbarDisplay = toolbar?.style.display || '';
        if (toolbar) toolbar.style.display = 'none';

        // ─── Mark & hide empty procedure rows ───
        updateEmptyRowClasses();
        for (let i = 1; i <= 10; i++) {
            const row = document.getElementById(`procedure-row-${i}`) as HTMLElement | null;
            if (!row) continue;
            allProcRows.push(row);
            if (row.classList.contains('row-empty')) {
                rowWasHidden.push(true);
                row.style.display = 'none';
                row.style.height = '0';
                row.style.margin = '0';
                row.style.padding = '0';
                row.style.overflow = 'hidden';
            } else {
                rowWasHidden.push(false);
            }
        }

        // ─── Save original bill styles ───
        const origStyles = {
            position: bill.style.position,
            left: bill.style.left,
            top: bill.style.top,
            margin: bill.style.margin,
            width: bill.style.width,
            height: bill.style.height,
            minHeight: bill.style.minHeight,
            maxWidth: bill.style.maxWidth,
            boxShadow: bill.style.boxShadow,
            borderRadius: bill.style.borderRadius,
            zIndex: bill.style.zIndex,
            overflow: bill.style.overflow,
        };

        // ─── A4 at 96 dpi ───
        const A4_W = 794;
        const A4_H = 1123;

        // ─── Lock bill to exact A4 dimensions for capture ───
        // Both width AND height are fixed so html2canvas captures
        // exactly one full A4 page with no blank bottom space.
        bill.style.position = 'fixed';
        bill.style.left = '0';
        bill.style.top = '0';
        bill.style.margin = '0';
        bill.style.width = `${A4_W}px`;
        bill.style.height = `${A4_H}px`;
        bill.style.minHeight = `${A4_H}px`;
        bill.style.maxWidth = 'none';
        bill.style.boxShadow = 'none';
        bill.style.borderRadius = '0';
        bill.style.zIndex = '9999';
        bill.style.overflow = 'hidden';

        // ─── Force flex on key layout elements ───
        const headerDetails = bill.querySelector('.header-details') as HTMLElement | null;
        const headerLeft = bill.querySelector('.header-left') as HTMLElement | null;
        const sigSection = bill.querySelector('.signatures-section') as HTMLElement | null;
        const billMeta = bill.querySelector('.bill-meta') as HTMLElement | null;
        const billForm = bill.querySelector('.bill-form') as HTMLElement | null;
        const origHDDisplay = headerDetails?.style.display || '';
        const origHDFlexDir = headerDetails?.style.flexDirection || '';
        const origHDJustify = headerDetails?.style.justifyContent || '';
        const origHLDisplay = headerLeft?.style.display || '';
        const origHLAlign = headerLeft?.style.alignItems || '';
        const origSigDisplay = sigSection?.style.display || '';
        const origSigJustify = sigSection?.style.justifyContent || '';
        const origBMDisplay = billMeta?.style.display || '';
        const origFormDisplay = billForm?.style.display || '';
        const origFormFlex = billForm?.style.flex || '';
        const origFormFlexDir = billForm?.style.flexDirection || '';

        if (headerDetails) {
            headerDetails.style.display = 'flex';
            headerDetails.style.flexDirection = 'row';
            headerDetails.style.justifyContent = 'space-between';
            headerDetails.style.alignItems = 'flex-start';
        }
        if (headerLeft) {
            headerLeft.style.display = 'flex';
            headerLeft.style.flexDirection = 'row';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '12px';
        }
        if (sigSection) {
            sigSection.style.display = 'flex';
            sigSection.style.flexDirection = 'row';
            sigSection.style.justifyContent = 'space-between';
            sigSection.style.alignItems = 'flex-start';
            sigSection.style.flexShrink = '0';
        }
        if (billMeta) {
            billMeta.style.display = 'flex';
            billMeta.style.flexDirection = 'row';
            billMeta.style.justifyContent = 'space-between';
        }
        // CRITICAL: bill-form must be flex column with flex:1 so the
        // .bill-spacer can grow and push signatures to the bottom.
        if (billForm) {
            billForm.style.display = 'flex';
            billForm.style.flexDirection = 'column';
            billForm.style.flex = '1';
        }

        const procedureRows = Array.from(bill.querySelectorAll('.procedure-row')) as HTMLElement[];
        const origProcRowStyles = procedureRows.map((row) => ({
            display: row.style.display,
            flexDirection: row.style.flexDirection,
            justifyContent: row.style.justifyContent,
            alignItems: row.style.alignItems,
        }));
        procedureRows.forEach((row) => {
            row.style.display = 'flex';
            row.style.flexDirection = 'row';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
        });

        // ─── Set spacer to flex:1 so it fills remaining A4 height ───
        const billSpacer = bill.querySelector('.bill-spacer') as HTMLElement | null;
        const origSpacerFlex = billSpacer?.style.flex || '';
        const origSpacerMinHeight = billSpacer?.style.minHeight || '';
        const origSpacerHeight = billSpacer?.style.height || '';

        if (billSpacer) {
            billSpacer.style.flex = '1';
            billSpacer.style.minHeight = '0';
            billSpacer.style.height = 'auto';
        }

        // ─── Hide input styling for clean capture ───
        const inputs = bill.querySelectorAll('input');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const savedInputStyles: any[] = [];
        inputs.forEach((inp) => {
            savedInputStyles.push({ borderBottom: inp.style.borderBottom, background: inp.style.background });
            inp.style.borderBottom = '1px solid transparent';
            inp.style.background = 'transparent';
        });

        // Wait two frames for layout to fully settle
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // ─── Restore all styles after capture ───
        const restoreStyles = () => {
            bill.style.position = origStyles.position;
            bill.style.left = origStyles.left;
            bill.style.top = origStyles.top;
            bill.style.margin = origStyles.margin;
            bill.style.width = origStyles.width;
            bill.style.height = origStyles.height;
            bill.style.minHeight = origStyles.minHeight;
            bill.style.maxWidth = origStyles.maxWidth;
            bill.style.boxShadow = origStyles.boxShadow;
            bill.style.borderRadius = origStyles.borderRadius;
            bill.style.zIndex = origStyles.zIndex;
            bill.style.overflow = origStyles.overflow;

            if (headerDetails) {
                headerDetails.style.display = origHDDisplay;
                headerDetails.style.flexDirection = origHDFlexDir;
                headerDetails.style.justifyContent = origHDJustify;
                headerDetails.style.alignItems = '';
            }
            if (headerLeft) {
                headerLeft.style.display = origHLDisplay;
                headerLeft.style.alignItems = origHLAlign;
                headerLeft.style.flexDirection = '';
                headerLeft.style.gap = '';
            }
            if (sigSection) {
                sigSection.style.display = origSigDisplay;
                sigSection.style.justifyContent = origSigJustify;
                sigSection.style.flexDirection = '';
                sigSection.style.alignItems = '';
                sigSection.style.flexShrink = '';
            }
            if (billMeta) {
                billMeta.style.display = origBMDisplay;
                billMeta.style.flexDirection = '';
                billMeta.style.justifyContent = '';
            }
            if (billForm) {
                billForm.style.display = origFormDisplay;
                billForm.style.flex = origFormFlex;
                billForm.style.flexDirection = origFormFlexDir;
            }

            procedureRows.forEach((row, idx) => {
                row.style.display = origProcRowStyles[idx].display;
                row.style.flexDirection = origProcRowStyles[idx].flexDirection;
                row.style.justifyContent = origProcRowStyles[idx].justifyContent;
                row.style.alignItems = origProcRowStyles[idx].alignItems;
            });

            if (billSpacer) {
                billSpacer.style.flex = origSpacerFlex;
                billSpacer.style.minHeight = origSpacerMinHeight;
                billSpacer.style.height = origSpacerHeight;
            }

            inputs.forEach((inp, idx) => {
                inp.style.borderBottom = savedInputStyles[idx].borderBottom;
                inp.style.background = savedInputStyles[idx].background;
            });

            if (toolbar) toolbar.style.display = origToolbarDisplay;

            allProcRows.forEach((row, idx) => {
                if (rowWasHidden[idx]) {
                    row.style.display = '';
                    row.style.height = '';
                    row.style.margin = '';
                    row.style.padding = '';
                    row.style.overflow = '';
                }
            });
            for (let i = 1; i <= 10; i++) {
                const row = document.getElementById(`procedure-row-${i}`);
                if (row) row.classList.remove('row-empty');
            }

            if (logoImg) logoImg.src = origLogoSrc;

            const fSpan = document.getElementById('billDateFormatted');
            if (fSpan) fSpan.remove();
            if (billDateInput) billDateInput.style.display = '';

            procDateInputs.forEach((inp, idx) => {
                const span = procFormattedSpans[idx];
                if (span?.parentNode) span.parentNode.removeChild(span);
                if (inp) inp.style.display = '';
            });
        };

        // ─── Capture with html2canvas → jsPDF ───
        // Bill is locked to exactly A4_W x A4_H px.
        // Canvas will be exactly one A4 page — mapped 1:1 to 210x297mm.
        try {
            const canvas = await html2canvas(bill, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: A4_W,
                windowHeight: A4_H,
                x: 0,
                y: 0,
                width: A4_W,
                height: A4_H,
                logging: false,
            });

            restoreStyles();

            const pdf = new jsPDF({
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.97);
            // Canvas is exactly A4 — fill the entire page, no blank space
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

            pdf.save(`DrMohana_Bill_${billNo}_${date}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
            restoreStyles();
        }
    };

    const clearFields = () => {
        if (window.confirm('Are you sure you want to clear all fields?')) {
            (document.getElementById('bill-form') as HTMLFormElement)?.reset();
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('billDate') as HTMLInputElement;
            if (dateInput) {
                dateInput.value = today;
            }
        }
    };

    return (
        <>
            {/* Toolbar */}
            <div className="toolbar">
                <div className="toolbar-brand">
                    <svg viewBox="0 0 24 24"><path d="M12,22C12,22 17,20.5 19,16.5C21,12.5 19,7 19,7C19,7 18.5,3.5 15,3C11.5,2.5 12,6 12,6C12,6 12.5,2.5 9,3C5.5,3.5 5,7 5,7C5,7 3,12.5 5,16.5C7,20.5 12,22 12,22Z" /></svg>
                    Dr. Mohana's Clinic
                </div>
                <div className="action-buttons">
                    <button className="btn-primary" onClick={handlePrint} aria-label="Print Bill">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print
                    </button>
                    <button className="btn-secondary" onClick={downloadPDF} aria-label="Download PDF">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        PDF
                    </button>
                    <button className="btn-danger" onClick={clearFields} aria-label="Clear Form">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Clear
                    </button>
                </div>
            </div>

            {/* App Shell */}
            <div className="app-shell">
                <div className="bill-container" id="bill-container" ref={billRef}>

                    {/* Header */}
                    <header className="bill-header">
                        <h1 className="clinic-name">Dr. Mohana's Dental Care</h1>
                        <div className="header-details">
                            <div className="header-left">
                                <img
                                    src="/logo.jpeg"
                                    alt="Dr. Mohana's Dental Care Logo"
                                    className="clinic-logo"
                                    crossOrigin="anonymous"
                                />
                                <div className="doctor-info">
                                    <div className="doctor-name">Dr. D. Mohanalakshmi M.D.S</div>
                                    <div className="doctor-title">Prosthodontist and Implantologist</div>
                                </div>
                            </div>
                            <div className="header-right">
                                <div className="appointment-label" style={{ marginTop: '4px' }}>For Appointment</div>
                                <div className="contact-info">Ph: 9003227250</div>
                                <div className="consulting-hours" style={{ marginTop: '6px' }}>
                                    Morning: 10.00 am to 1.00 pm<br />
                                    Evening: 5.30 pm to 8.30 pm<br />
                                    (Sunday holiday)
                                </div>
                            </div>
                        </div>
                    </header>

                    <hr className="bill-divider" />

                    <div className="services-strip">
                        Dental Implants &bull; Orthodontics Braces &bull; Invisible Aligners &bull; Root Canal Treatment &bull; Child Dentistry &bull; Crown and Bridge &bull; Complete Dentures &bull; Cosmetic Dentistry
                    </div>

                    <div className="address-line">
                        No. 41/5, Karpagam Gardens, 1st Main Road, Adyar, Chennai - 600 020.
                    </div>

                    {/* Bill Form */}
                    <form id="bill-form" className="bill-form" onSubmit={(e) => e.preventDefault()}>

                        <div className="bill-meta">
                            <div>
                                <label htmlFor="billNo">BILL NO:-</label>
                                <input type="text" id="billNo" className="input-inline bill-no-input" placeholder="001" />
                            </div>
                            <div>
                                <label htmlFor="billDate">DATE:-</label>
                                <input type="date" id="billDate" className="input-inline date-input" />
                            </div>
                        </div>

                        <div className="patient-info">
                            This is to certify that
                            <label htmlFor="patientName" style={{ display: 'none' }}>Patient Name</label>
                            <input
                              type="text"
                              id="patientName"
                              className="input-inline patient-name-input"
                              placeholder="Patient Name"
                              onChange={(e) => autoResizeInput(e.target as HTMLInputElement)}
                              onInput={(e) => autoResizeInput(e.target as HTMLInputElement)}
                            />
                            aged
                            <label htmlFor="patientAge" style={{ display: 'none' }}>Age</label>
                            <input type="number" id="patientAge" className="input-inline age-input" placeholder="00" min="0" max="150" />
                            yrs was under my treatment for the following dental procedures
                        </div>

                        <div className="procedures-section">
                            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                <div className="procedure-row" id={`procedure-row-${n}`} key={n}>
                                    <div className="procedure-left">
                                        <span className="proc-number" aria-hidden="true">{n}.</span>
                                        <label htmlFor={`proc${n}Name`} style={{ display: 'none' }}>Procedure {n}</label>
                                        <input type="text" id={`proc${n}Name`} className="input-inline procedure-name-input" placeholder="Procedure description" />
                                    </div>
                                    <div className="procedure-right">
                                        <label htmlFor={`proc${n}Date`}>ON</label>
                                        <input type="date" id={`proc${n}Date`} className="input-inline procedure-date-input" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Spacer — grows to fill remaining space, pushing signatures to bottom */}
                        <div className="bill-spacer"></div>

                        <div className="amount-section" style={{ marginBottom: '30px' }}>
                            I have performed the above mentioned treatment procedures with informed consent from the patient and received Rs.
                            <label htmlFor="amount" style={{ display: 'none' }}>Amount</label>
                            <input
                            type="text"
                            id="amount"
                            className="input-inline amount-input"
                            placeholder="1000"
                            style={{
                                width: '60px',
                                textAlign: 'center',
                                padding: '0 2px',
                                border: 'none',
                                borderBottom: '1px solid #000',
                                background: 'transparent'
                            }}
                            />
                            for the above mentioned treatment as professional charges.
                        </div>

                        <div className="signatures-section">
                            <div className="signature-box">
                                <div className="signature-line"></div>
                                <div className="signature-label">Doctor's Seal:-</div>
                            </div>
                            <div className="signature-box">
                                <div className="signature-line"></div>
                                <div className="signature-label">Doctor's Signature:</div>
                            </div>
                        </div>
                    </form>

                </div>
            </div>
        </>
    );
}

export default App;
