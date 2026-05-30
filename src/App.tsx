import { useEffect, useRef } from 'react';
import './App.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const html2pdf: any;

function App() {
    const billRef = useRef<HTMLDivElement>(null);

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
                    resolve(url); // fallback to original url
                }
            };
            img.onerror = () => resolve(url); // fallback
            img.src = url + '?t=' + Date.now(); // cache-bust
        });
    };

    useEffect(() => {
        // Set today's date on load
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('billDate') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = today;
        }
    }, []);

    /*
    const getBillSummary = () => {
        const billNo = (document.getElementById('billNo') as HTMLInputElement)?.value || 'N/A';
        const date = (document.getElementById('billDate') as HTMLInputElement)?.value || 'N/A';
        const name = (document.getElementById('patientName') as HTMLInputElement)?.value || 'Patient';
        const age = (document.getElementById('patientAge') as HTMLInputElement)?.value || '';
        const amount = (document.getElementById('amount') as HTMLInputElement)?.value || '0';

        const lines = [];
        lines.push("Dr. Mohana's Dental Care");
        lines.push("Bill No: " + billNo);
        lines.push("Date: " + date);
        lines.push("Patient: " + name + (age ? " (Age: " + age + ")" : ""));
        lines.push("");
        lines.push("Procedures:");
        for (let i = 1; i <= 10; i++) {
            const procName = (document.getElementById('proc' + i + 'Name') as HTMLInputElement)?.value;
            const procDate = (document.getElementById('proc' + i + 'Date') as HTMLInputElement)?.value;
            if (procName) {
                lines.push(i + ". " + procName + (procDate ? " (on " + procDate + ")" : ""));
            }
        }
        lines.push("");
        lines.push("Amount Received: Rs. " + amount);
        lines.push("");
        lines.push("Thank you for choosing Dr. Mohana's Dental Care!");
        return lines.join("\n");
    };
    */

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
        const date = (document.getElementById('billDate') as HTMLInputElement)?.value || 'Date';

        // Declare tracking arrays for hiding empty rows inline (for html2canvas)
        const allProcRows: HTMLElement[] = [];
        const rowWasHidden: boolean[] = [];
        let logoImg: HTMLImageElement | null = null;
        let origLogoSrc = '';

        // Step 0: Convert logo to base64 to avoid CORS issues in html2canvas
        logoImg = bill.querySelector('.clinic-logo') as HTMLImageElement | null;
        origLogoSrc = logoImg?.src || '';
        if (logoImg) {
            const base64src = await getBase64Image('/logo.jpeg');
            logoImg.src = base64src;
            // Wait for the new src to load
            await new Promise<void>((resolve) => {
                if (logoImg.complete) { resolve(); return; }
                logoImg.onload = () => resolve();
                logoImg.onerror = () => resolve();
            });
        }

        // Step 1: Wait for all images inside the bill to be fully loaded
        const images = Array.from(bill.querySelectorAll('img'));
        await Promise.all(
            images.map(
                (img) =>
                    new Promise<void>((resolve) => {
                        if (img.complete && img.naturalWidth > 0) {
                            resolve();
                        } else {
                            img.onload = () => resolve();
                            img.onerror = () => resolve();
                        }
                    })
            )
        );

        // Step 2: Scroll to top before capture to eliminate vertical offset
        window.scrollTo(0, 0);

        // Step 3: Hide toolbar so it is not captured
        const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
        const origToolbarDisplay = toolbar?.style.display || '';
        if (toolbar) toolbar.style.display = 'none';

        // Mark empty rows via class (for print CSS)
        updateEmptyRowClasses();

        // Also hide empty rows via inline style (for html2canvas — ignores @media print)
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

        // Step 4: Save original bill styles
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

        // Step 5: Position bill at exact top-left for capture
        bill.style.position = 'fixed';
        bill.style.left = '0';
        bill.style.top = '0';
        bill.style.margin = '0';
        bill.style.width = '719px';
        // CRITICAL: Do NOT set a fixed height — let content define height naturally
        // Setting height: 1123px causes the spacer to expand and overflow into page 2
        bill.style.height = 'auto';
        bill.style.minHeight = 'auto';
        bill.style.maxWidth = 'none';
        bill.style.boxShadow = 'none';
        bill.style.borderRadius = '0';
        bill.style.zIndex = '9999';
        // CRITICAL: Do NOT set overflow: hidden — it clips signatures below the spacer
        bill.style.overflow = 'visible';

        // Step 6: Force inline flex on header elements so html2canvas respects them
        const headerDetails = bill.querySelector('.header-details') as HTMLElement | null;
        const headerLeft = bill.querySelector('.header-left') as HTMLElement | null;
        const origHeaderDetailsDisplay = headerDetails?.style.display || '';
        const origHeaderDetailsFlexDir = headerDetails?.style.flexDirection || '';
        const origHeaderDetailsJustify = headerDetails?.style.justifyContent || '';
        const origHeaderLeftDisplay = headerLeft?.style.display || '';
        const origHeaderLeftAlign = headerLeft?.style.alignItems || '';
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

        // Step 7: Force inline flex on signatures section so they stay side-by-side
        const sigSection = bill.querySelector('.signatures-section') as HTMLElement | null;
        const origSigDisplay = sigSection?.style.display || '';
        const origSigJustify = sigSection?.style.justifyContent || '';
        if (sigSection) {
            sigSection.style.display = 'flex';
            sigSection.style.flexDirection = 'row';
            sigSection.style.justifyContent = 'space-between';
            sigSection.style.alignItems = 'flex-start';
        }

        // Step 8: Force inline flex on bill-meta and procedure-rows
        const billMeta = bill.querySelector('.bill-meta') as HTMLElement | null;
        const origBillMetaDisplay = billMeta?.style.display || '';
        if (billMeta) {
            billMeta.style.display = 'flex';
            billMeta.style.flexDirection = 'row';
            billMeta.style.justifyContent = 'space-between';
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

        // Step 9: Set bill-spacer to push footer content to the bottom of A4
        const billSpacer = bill.querySelector('.bill-spacer') as HTMLElement | null;
        const origSpacerFlex = billSpacer?.style.flex || '';
        const origSpacerMinHeight = billSpacer?.style.minHeight || '';
        const origSpacerHeight = billSpacer?.style.height || '';

        // Step 9: Calculate exact spacer height to push footer to bottom of A4
        const A4_HEIGHT_PX = 1059;
        const billPaddingTopBottom = 72; // matches CSS padding: 36px top + 36px bottom

        // Temporarily collapse spacer to 0 so we can measure true content heights
        if (billSpacer) {
            billSpacer.style.flex = 'none';
            billSpacer.style.minHeight = '0';
            billSpacer.style.height = '0px';
        }

        // Wait one frame for the collapse to paint
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Now measure: everything in the bill excluding the spacer
        const totalContentWithoutSpacer = bill.scrollHeight;

        // The spacer should fill the gap so total = A4_HEIGHT_PX
        const spacerHeight = Math.max(20, A4_HEIGHT_PX - billPaddingTopBottom - totalContentWithoutSpacer);

        if (billSpacer) {
            billSpacer.style.height = `${spacerHeight}px`;
        }

        // Wait one more frame for the spacer to expand
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Step 10: Hide input borders for clean PDF output
        const inputs = bill.querySelectorAll('input');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const savedInputStyles: any[] = [];
        inputs.forEach((inp) => {
            savedInputStyles.push({
                borderBottom: inp.style.borderBottom,
                background: inp.style.background,
            });
            inp.style.borderBottom = '1px solid transparent';
            inp.style.background = 'transparent';
        });

        // Step 11: Wait two animation frames so all style changes are painted
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const opt = {
            margin: [8, 10, 8, 10],
            filename: `DrMohana_Bill_${billNo}_${date}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 3,
                useCORS: true,
                allowTaint: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 719,
                windowHeight: 1059,
                x: 0,
                y: 0,
                width: 719,
                height: 1059,   // Fixed A4 height — ensures single page, no overflow
                logging: false,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: false },
            pagebreak: { mode: 'avoid-all' },
        };

        const restoreStyles = () => {
            // Restore bill container
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

            // Restore header
            if (headerDetails) {
                headerDetails.style.display = origHeaderDetailsDisplay;
                headerDetails.style.flexDirection = origHeaderDetailsFlexDir;
                headerDetails.style.justifyContent = origHeaderDetailsJustify;
                headerDetails.style.alignItems = '';
            }
            if (headerLeft) {
                headerLeft.style.display = origHeaderLeftDisplay;
                headerLeft.style.alignItems = origHeaderLeftAlign;
                headerLeft.style.flexDirection = '';
                headerLeft.style.gap = '';
            }

            // Restore signatures
            if (sigSection) {
                sigSection.style.display = origSigDisplay;
                sigSection.style.justifyContent = origSigJustify;
                sigSection.style.flexDirection = '';
                sigSection.style.alignItems = '';
            }

            // Restore bill-meta
            if (billMeta) {
                billMeta.style.display = origBillMetaDisplay;
                billMeta.style.flexDirection = '';
                billMeta.style.justifyContent = '';
            }

            // Restore procedure rows
            procedureRows.forEach((row, idx) => {
                row.style.display = origProcRowStyles[idx].display;
                row.style.flexDirection = origProcRowStyles[idx].flexDirection;
                row.style.justifyContent = origProcRowStyles[idx].justifyContent;
                row.style.alignItems = origProcRowStyles[idx].alignItems;
            });

            // Restore spacer
            if (billSpacer) {
                billSpacer.style.flex = origSpacerFlex;
                billSpacer.style.minHeight = origSpacerMinHeight;
                billSpacer.style.height = origSpacerHeight;
            }

            // Restore inputs
            inputs.forEach((inp, idx) => {
                inp.style.borderBottom = savedInputStyles[idx].borderBottom;
                inp.style.background = savedInputStyles[idx].background;
            });

            // Restore toolbar
            if (toolbar) toolbar.style.display = origToolbarDisplay;

            // Restore inline styles that were applied to empty rows for PDF capture
            allProcRows.forEach((row, idx) => {
                if (rowWasHidden[idx]) {
                    row.style.display = '';
                    row.style.height = '';
                    row.style.margin = '';
                    row.style.padding = '';
                    row.style.overflow = '';
                }
            });
            // Also remove row-empty class from all rows
            for (let i = 1; i <= 10; i++) {
                const row = document.getElementById(`procedure-row-${i}`);
                if (row) row.classList.remove('row-empty');
            }

            // Restore logo src
            if (logoImg) {
                logoImg.src = origLogoSrc;
            }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf()
                .set(opt)
                .from(bill)
                .save()
                .then(restoreStyles)
                .catch(restoreStyles);
        } else {
            restoreStyles();
            console.error('html2pdf is not loaded');
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
                                <div className="contact-info">Ph: +91 9003227250</div>
                                <div className="consulting-hours">
                                    Morning: 10.00 am to 1.00 pm<br />
                                    Evening: 5.30 pm to 8.30 pm<br />
                                    (Sunday holiday)
                                </div>
                                <div className="appointment-label">For Appointment</div>
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
                            <input type="text" id="patientName" className="input-inline patient-name-input" placeholder="Patient Name" />
                            aged
                            <label htmlFor="patientAge" style={{ display: 'none' }}>Age</label>
                            <input type="number" id="patientAge" className="input-inline age-input" placeholder="00" min="0" max="150" />
                            yrs was under my treatment for the following dental procedures 
                        </div>

                        <div className="procedures-section">
                            <div className="procedure-row" id="procedure-row-1">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">1.</span>
                                    <label htmlFor="proc1Name" style={{ display: 'none' }}>Procedure 1</label>
                                    <input type="text" id="proc1Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc1Date">ON</label>
                                    <input type="date" id="proc1Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-2">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">2.</span>
                                    <label htmlFor="proc2Name" style={{ display: 'none' }}>Procedure 2</label>
                                    <input type="text" id="proc2Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc2Date">ON</label>
                                    <input type="date" id="proc2Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-3">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">3.</span>
                                    <label htmlFor="proc3Name" style={{ display: 'none' }}>Procedure 3</label>
                                    <input type="text" id="proc3Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc3Date">ON</label>
                                    <input type="date" id="proc3Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-4">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">4.</span>
                                    <label htmlFor="proc4Name" style={{ display: 'none' }}>Procedure 4</label>
                                    <input type="text" id="proc4Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc4Date">ON</label>
                                    <input type="date" id="proc4Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-5">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">5.</span>
                                    <label htmlFor="proc5Name" style={{ display: 'none' }}>Procedure 5</label>
                                    <input type="text" id="proc5Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc5Date">ON</label>
                                    <input type="date" id="proc5Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-6">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">6.</span>
                                    <label htmlFor="proc6Name" style={{ display: 'none' }}>Procedure 6</label>
                                    <input type="text" id="proc6Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc6Date">ON</label>
                                    <input type="date" id="proc6Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-7">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">7.</span>
                                    <label htmlFor="proc7Name" style={{ display: 'none' }}>Procedure 7</label>
                                    <input type="text" id="proc7Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc7Date">ON</label>
                                    <input type="date" id="proc7Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-8">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">8.</span>
                                    <label htmlFor="proc8Name" style={{ display: 'none' }}>Procedure 8</label>
                                    <input type="text" id="proc8Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc8Date">ON</label>
                                    <input type="date" id="proc8Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-9">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">9.</span>
                                    <label htmlFor="proc9Name" style={{ display: 'none' }}>Procedure 9</label>
                                    <input type="text" id="proc9Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc9Date">ON</label>
                                    <input type="date" id="proc9Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row" id="procedure-row-10">
                                <div className="procedure-left">
                                    <span className="proc-number" aria-hidden="true">10.</span>
                                    <label htmlFor="proc10Name" style={{ display: 'none' }}>Procedure 10</label>
                                    <input type="text" id="proc10Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc10Date">ON</label>
                                    <input type="date" id="proc10Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                        </div>

                        {/* Spacer pushes the amount and signatures to the bottom */}
                        <div className="bill-spacer"></div>

                        <div className="amount-section" style={{ marginBottom: '30px' }}>
                            I have received Rs.
                            <label htmlFor="amount" style={{ display: 'none' }}>Amount</label>
                            <input type="number" id="amount" className="input-inline amount-input" placeholder="0.00" min="0" step="0.01" />
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
