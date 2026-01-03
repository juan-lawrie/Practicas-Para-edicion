import React, { useState, useEffect } from 'react';
import { formatMovementDate } from '../utils/date';

const Movimientos_De_Caja = ({ cashMovements }) => {
    const [cashSortOrder, setCashSortOrder] = useState('desc');
    const [cashAmountFilter, setCashAmountFilter] = useState('');
    const [cashAmountFilterOp, setCashAmountFilterOp] = useState('equals');
    const [cashDescriptionFilter, setCashDescriptionFilter] = useState('');
    const [cashDescriptionFilterOp, setCashDescriptionFilterOp] = useState('contains');
    const [cashPaymentMethodFilter, setCashPaymentMethodFilter] = useState([]);
    const [cashDateFromYear, setCashDateFromYear] = useState('');
    const [cashDateFromMonth, setCashDateFromMonth] = useState('');
    const [cashDateFromDay, setCashDateFromDay] = useState('');
    const [cashDateFromHour, setCashDateFromHour] = useState('');
    const [cashDateFromMinute, setCashDateFromMinute] = useState('');
    const [cashDateToYear, setCashDateToYear] = useState('');
    const [cashDateToMonth, setCashDateToMonth] = useState('');
    const [cashDateToDay, setCashDateToDay] = useState('');
    const [cashDateToHour, setCashDateToHour] = useState('');
    const [cashDateToMinute, setCashDateToMinute] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    
    // Estado para el diálogo de historial
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [dialogSize, setDialogSize] = useState({ width: 1000, height: 700 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dialogPosition, setDialogPosition] = useState({ x: 150, y: 50 });
    const [resizeStart, setResizeStart] = useState({ width: 0, height: 0 });

    const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

    // Función para parsear fechas
    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        const str = String(dateStr).trim();
        if (!str) return null;
        const date = new Date(str);
        if (isNaN(date.getTime())) {
            const parts = str.split(/[\/-]/);
            if (parts.length === 3) {
                const [a, b, c] = parts;
                const attempt1 = new Date(`${c}-${a}-${b}`);
                if (!isNaN(attempt1.getTime())) return attempt1;
                const attempt2 = new Date(`${a}-${b}-${c}`);
                if (!isNaN(attempt2.getTime())) return attempt2;
            }
            return null;
        }
        return date;
    };

    // Función para obtener movimientos filtrados
    const getFilteredCashMovements = () => {
        let filtered = [...cashMovements];
        
        if (cashAmountFilter.trim()) {
            filtered = filtered.filter(movement => {
                const movementAmount = Number(movement.amount) || 0;
                const filterAmount = Number(cashAmountFilter) || 0;
                
                switch (cashAmountFilterOp) {
                    case 'equals': return movementAmount === filterAmount;
                    case 'lt': return movementAmount < filterAmount;
                    case 'lte': return movementAmount <= filterAmount;
                    case 'gt': return movementAmount > filterAmount;
                    case 'gte': return movementAmount >= filterAmount;
                    default: return movementAmount === filterAmount;
                }
            });
        }
        
        if (cashDescriptionFilter.trim()) {
            filtered = filtered.filter(movement => {
                const description = String(movement.description || '').toLowerCase();
                const filterValue = cashDescriptionFilter.toLowerCase();
                
                switch (cashDescriptionFilterOp) {
                    case 'equals': return description === filterValue;
                    case 'contains': return description.includes(filterValue);
                    default: return description.includes(filterValue);
                }
            });
        }
        
        if (cashPaymentMethodFilter.length > 0) {
            filtered = filtered.filter(movement => {
                const method = (movement.payment_method || '').toLowerCase();
                return cashPaymentMethodFilter.some(selected => method.includes(selected.toLowerCase()));
            });
        }

        if (cashDateFromYear || cashDateFromMonth || cashDateFromDay || cashDateFromHour || cashDateFromMinute || 
            cashDateToYear || cashDateToMonth || cashDateToDay || cashDateToHour || cashDateToMinute) {
            filtered = filtered.filter(movement => {
                const movementDate = parseAnyDate(movement.date);
                if (!movementDate) return false;
                const hasToFilters = cashDateToYear || cashDateToMonth || cashDateToDay || cashDateToHour || cashDateToMinute;
                let matches = true;

                if (cashDateFromYear && matches) {
                    if (hasToFilters) {
                        matches = movementDate.getFullYear() >= parseInt(cashDateFromYear);
                    } else {
                        matches = movementDate.getFullYear() === parseInt(cashDateFromYear);
                    }
                }

                if (cashDateFromMonth && matches) {
                    if (hasToFilters) {
                        if (cashDateFromYear) {
                            const yearMatches = movementDate.getFullYear() > parseInt(cashDateFromYear);
                            const yearExact = movementDate.getFullYear() === parseInt(cashDateFromYear);
                            matches = yearMatches || (yearExact && movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1));
                        } else {
                            matches = movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                        matches = yearMatches && movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    }
                }

                if (cashDateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !cashDateFromYear || movementDate.getFullYear() >= parseInt(cashDateFromYear);
                        const monthMatch = !cashDateFromMonth || movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1);
                        if (cashDateFromYear && cashDateFromMonth) {
                            const exactYearMonth = movementDate.getFullYear() === parseInt(cashDateFromYear) && 
                                                   movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && movementDate.getDate() >= parseInt(cashDateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && movementDate.getDate() >= parseInt(cashDateFromDay);
                        }
                    } else {
                        const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                        const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                        matches = yearMatches && monthMatches && movementDate.getDate() === parseInt(cashDateFromDay);
                    }
                }

                if (cashDateFromHour && matches) {
                    const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                    const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    const dayMatches = !cashDateFromDay || movementDate.getDate() === parseInt(cashDateFromDay);
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = movementDate.getHours() >= parseInt(cashDateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && movementDate.getHours() === parseInt(cashDateFromHour);
                    }
                }

                if (cashDateFromMinute && matches) {
                    const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                    const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    const dayMatches = !cashDateFromDay || movementDate.getDate() === parseInt(cashDateFromDay);
                    const hourMatches = !cashDateFromHour || movementDate.getHours() === parseInt(cashDateFromHour);
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = movementDate.getMinutes() >= parseInt(cashDateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && movementDate.getMinutes() === parseInt(cashDateFromMinute);
                    }
                }

                if (hasToFilters) {
                    if (cashDateToYear && matches) {
                        matches = movementDate.getFullYear() <= parseInt(cashDateToYear);
                    }
                    if (cashDateToMonth && matches) {
                        if (cashDateToYear) {
                            const yearMatches = movementDate.getFullYear() < parseInt(cashDateToYear);
                            const yearExact = movementDate.getFullYear() === parseInt(cashDateToYear);
                            matches = yearMatches || (yearExact && movementDate.getMonth() <= (parseInt(cashDateToMonth) - 1));
                        } else {
                            matches = movementDate.getMonth() <= (parseInt(cashDateToMonth) - 1);
                        }
                    }
                    if (cashDateToDay && matches) {
                        const exactYearMonth = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) && 
                                               (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = movementDate.getDate() <= parseInt(cashDateToDay);
                        }
                    }
                    if (cashDateToHour && matches) {
                        const exactDate = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) &&
                                          (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1)) &&
                                          (!cashDateToDay || movementDate.getDate() === parseInt(cashDateToDay));
                        if (exactDate) {
                            matches = movementDate.getHours() <= parseInt(cashDateToHour);
                        }
                    }
                    if (cashDateToMinute && matches) {
                        const exactDateTime = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) &&
                                              (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1)) &&
                                              (!cashDateToDay || movementDate.getDate() === parseInt(cashDateToDay)) &&
                                              (!cashDateToHour || movementDate.getHours() === parseInt(cashDateToHour));
                        if (exactDateTime) {
                            matches = movementDate.getMinutes() <= parseInt(cashDateToMinute);
                        }
                    }
                }
                return matches;
            });
        }
        
        return filtered;
    };

    const filteredMovements = getFilteredCashMovements().sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return cashSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Effect para manejar drag/resize con eventos globales
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragStart.x));
                const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStart.y));
                setDialogPosition({ x: newX, y: newY });
            } else if (isResizing) {
                const deltaX = e.clientX - dragStart.x;
                const deltaY = e.clientY - dragStart.y;
                const newWidth = Math.max(800, Math.min(window.innerWidth - dialogPosition.x - 20, resizeStart.width + deltaX));
                const newHeight = Math.max(500, Math.min(window.innerHeight - dialogPosition.y - 20, resizeStart.height + deltaY));
                setDialogSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, dialogPosition, resizeStart]);

    // Función para abrir el diálogo en ventana nueva
    const openInNewWindow = () => {
        // Pasar los movimientos completos sin filtrar
        const allMovements = JSON.stringify(cashMovements);
        
        // Usar about:blank y configurar como ventana independiente
        const newWindow = window.open('about:blank', '_blank', 'width=1500,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
        if (newWindow) {
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Historial de Movimientos de Caja</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                        .filters-row { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 16px; }
                        .date-group { display: flex; align-items: center; gap: 8px; }
                        .date-label { font-size: 0.95em; margin-right: 8px; min-width: 70px; }
                        .date-input { width: 48px; padding: 2px 4px; font-size: 0.95em; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
                        .date-input.year { width: 60px; }
                        .date-input:focus { outline: 2px solid #2563eb; border-color: #2563eb; }
                        @media (max-width: 900px) {
                            .filters-row { flex-direction: column; gap: 12px; }
                        }
                        /* Breakpoints personalizados para el grid */
                        @media (min-width: 1200px) and (max-width: 1279px) {
                            #movementsGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
                        }
                        @media (min-width: 1280px) and (max-width: 1399px) {
                            #movementsGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
                        }
                        @media (min-width: 1400px) and (max-width: 1599px) {
                            #movementsGrid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
                        }
                        @media (min-width: 1600px) and (max-width: 1899px) {
                            #movementsGrid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
                        }
                        @media (min-width: 1900px) and (max-width: 2399px) {
                            #movementsGrid { grid-template-columns: repeat(7, minmax(0, 1fr)); }
                        }
                        @media (min-width: 2400px) {
                            #movementsGrid { grid-template-columns: repeat(8, minmax(0, 1fr)); }
                        }
                    </style>
                </head>
                <body class="bg-gray-50">
                    <script>
                        // Datos de movimientos
                        const allMovements = ${allMovements};
                        
                        // Estado de filtros
                        let filters = {
                            sortOrder: 'desc',
                            amountFilter: '',
                            amountFilterOp: 'equals',
                            descriptionFilter: '',
                            descriptionFilterOp: 'contains',
                            paymentMethodFilter: [],
                            dateFromYear: '', dateFromMonth: '', dateFromDay: '', dateFromHour: '', dateFromMinute: '',
                            dateToYear: '', dateToMonth: '', dateToDay: '', dateToHour: '', dateToMinute: ''
                        };
                        
                        function formatDate(dateStr) {
                            if (!dateStr) return '';
                            const date = new Date(dateStr);
                            if (isNaN(date.getTime())) return dateStr;
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hour = String(date.getHours()).padStart(2, '0');
                            const minute = String(date.getMinutes()).padStart(2, '0');
                            return year + '/' + month + '/' + day + ', ' + hour + ':' + minute;
                        }
                        
                        function filterMovements() {
                            let filtered = [...allMovements];
                            
                            // Filtro de monto
                            if (filters.amountFilter.trim()) {
                                filtered = filtered.filter(m => {
                                    const mAmount = Number(m.amount) || 0;
                                    const fAmount = Number(filters.amountFilter) || 0;
                                    switch (filters.amountFilterOp) {
                                        case 'equals': return mAmount === fAmount;
                                        case 'lt': return mAmount < fAmount;
                                        case 'lte': return mAmount <= fAmount;
                                        case 'gt': return mAmount > fAmount;
                                        case 'gte': return mAmount >= fAmount;
                                        default: return true;
                                    }
                                });
                            }
                            
                            // Filtro de descripción
                            if (filters.descriptionFilter.trim()) {
                                filtered = filtered.filter(m => {
                                    const desc = String(m.description || '').toLowerCase();
                                    const filter = filters.descriptionFilter.toLowerCase();
                                    return filters.descriptionFilterOp === 'contains' ? desc.includes(filter) : desc === filter;
                                });
                            }
                            
                            // Filtro de métodos de pago
                            if (filters.paymentMethodFilter.length > 0) {
                                filtered = filtered.filter(m => {
                                    const method = (m.payment_method || '').toLowerCase();
                                    return filters.paymentMethodFilter.some(selected => method.includes(selected.toLowerCase()));
                                });
                            }
                            
                            // Ordenar
                            filtered.sort((a, b) => {
                                const dateA = new Date(a.date);
                                const dateB = new Date(b.date);
                                return filters.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                            });
                            
                            return filtered;
                        }
                        
                        function renderMovements() {
                            const filtered = filterMovements();
                            document.getElementById('movementCount').textContent = filtered.length + ' movimientos';
                            
                            const container = document.getElementById('movementsGrid');
                            if (filtered.length === 0) {
                                container.innerHTML = '<p class="text-center text-gray-500 py-12 text-lg col-span-full">No se encontraron movimientos</p>';
                            } else {
                                container.innerHTML = filtered.map(m => \`
                                    <div class="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors hover:shadow-md">
                                        <div class="flex justify-between items-start mb-3">
                                            <span class="text-xs text-gray-500">\${formatDate(m.date)}</span>
                                            <span class="text-lg font-bold text-green-600">$\${Number(m.amount).toFixed(2)}</span>
                                        </div>
                                        <div class="font-medium text-gray-800 text-sm">
                                            <p class="line-clamp-2 mb-2">\${m.description}</p>
                                            \${m.payment_method ? \`<span class="block text-xs text-gray-600 mb-2 capitalize"> \${m.payment_method}</span>\` : ''}

                                        </div>
                                    </div>
                                \`).join('');
                            }
                        }
                        
                        function updateFilter(key, value) {
                            filters[key] = value;
                            renderMovements();
                        }
                        
                        function togglePaymentMethod(method) {
                            const index = filters.paymentMethodFilter.indexOf(method);
                            if (index > -1) {
                                filters.paymentMethodFilter.splice(index, 1);
                            } else {
                                filters.paymentMethodFilter.push(method);
                            }
                            renderMovements();
                        }
                    </script>
                    <div class="min-h-screen">
                        <!-- Barra superior -->
                        <div class="bg-blue-600 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
                            <div class="flex items-center gap-4">
                                <h1 class="font-bold text-xl">Historial de Movimientos de Caja</h1>
                                <span id="movementCount" class="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-semibold">
                                    ${allMovements.length} movimientos
                                </span>
                            </div>
                            <button onclick="window.close()" class="text-white hover:bg-red-600 font-bold text-3xl leading-none px-3">×</button>
                        </div>

                        <!-- Filtros Interactivos -->
                        <div class="bg-white border-b border-gray-200 p-4 shadow-sm">
                            <h4 class="text-md font-bold text-gray-700 mb-3">🔍 Filtros</h4>
                            
                            <!-- Fila 1: Orden + Select Monto + Input Monto -->
                            <div class="grid gap-3 mb-3" style="grid-template-columns: 1fr 180px 1fr;">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">ORDEN</label>
                                    <select onchange="updateFilter('sortOrder', this.value)" class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                                        <option value="desc">Más nuevos primero</option>
                                        <option value="asc">Más viejos primero</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">OPERACIÓN MONTO</label>
                                    <select onchange="updateFilter('amountFilterOp', this.value)" class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                                        <option value="equals">Es igual</option>
                                        <option value="lt">Menor que</option>
                                        <option value="lte">Menor o igual</option>
                                        <option value="gt">Mayor que</option>
                                        <option value="gte">Mayor o igual</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">MONTO</label>
                                    <input type="number" oninput="updateFilter('amountFilter', this.value)" placeholder="0.00" class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                                </div>
                            </div>

                            <!-- Fila 2: Select Descripción + Input Descripción -->
                            <div class="grid gap-3 mb-3" style="grid-template-columns: 180px 1fr;">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">TIPO BÚSQUEDA</label>
                                    <select onchange="updateFilter('descriptionFilterOp', this.value)" class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1">BUSCAR DESCRIPCIÓN</label>
                                    <input type="text" oninput="updateFilter('descriptionFilter', this.value)" placeholder="Escribe para buscar..." class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                                </div>
                            </div>

                            <!-- Métodos de pago + Fechas en una sola fila -->
                            <div class="filters-row">
                                <div class="flex flex-wrap items-center gap-3 mr-4">
                                    <label class="block text-xs font-semibold text-gray-700 mr-2">MÉTODOS DE PAGO</label>
                                    <label class="flex items-center gap-1.5">
                                        <input type="checkbox" onclick="togglePaymentMethod('efectivo')" class="rounded text-blue-600">
                                        <span class="text-sm capitalize">Efectivo</span>
                                    </label>
                                    <label class="flex items-center gap-1.5">
                                        <input type="checkbox" onclick="togglePaymentMethod('debito')" class="rounded text-blue-600">
                                        <span class="text-sm capitalize">Débito</span>
                                    </label>
                                    <label class="flex items-center gap-1.5">
                                        <input type="checkbox" onclick="togglePaymentMethod('credito')" class="rounded text-blue-600">
                                        <span class="text-sm capitalize">Crédito</span>
                                    </label>
                                    <label class="flex items-center gap-1.5">
                                        <input type="checkbox" onclick="togglePaymentMethod('transferencia')" class="rounded text-blue-600">
                                        <span class="text-sm capitalize">Transferencia</span>
                                    </label>
                                </div>
                                <div class="date-group mr-4">
                                    <span class="date-label">Fecha desde:</span>
                                    <input class="date-input year" id="dateFromYear" maxlength="4" placeholder="Año" oninput="updateFilter('dateFromYear', this.value)" />
                                    <input class="date-input" id="dateFromMonth" maxlength="2" placeholder="Mes" oninput="updateFilter('dateFromMonth', this.value)" />
                                    <input class="date-input" id="dateFromDay" maxlength="2" placeholder="Día" oninput="updateFilter('dateFromDay', this.value)" />
                                    <input class="date-input" id="dateFromHour" maxlength="2" placeholder="Hora" oninput="updateFilter('dateFromHour', this.value)" />
                                    <input class="date-input" id="dateFromMinute" maxlength="2" placeholder="Min" oninput="updateFilter('dateFromMinute', this.value)" />
                                </div>
                                <div class="date-group">
                                    <span class="date-label">Fecha hasta:</span>
                                    <input class="date-input year" id="dateToYear" maxlength="4" placeholder="Año" oninput="updateFilter('dateToYear', this.value)" />
                                    <input class="date-input" id="dateToMonth" maxlength="2" placeholder="Mes" oninput="updateFilter('dateToMonth', this.value)" />
                                    <input class="date-input" id="dateToDay" maxlength="2" placeholder="Día" oninput="updateFilter('dateToDay', this.value)" />
                                    <input class="date-input" id="dateToHour" maxlength="2" placeholder="Hora" oninput="updateFilter('dateToHour', this.value)" />
                                    <input class="date-input" id="dateToMinute" maxlength="2" placeholder="Min" oninput="updateFilter('dateToMinute', this.value)" />
                                </div>
                            </div>
                        </div>

                        <!-- Grid de movimientos -->
                        <div class="p-6">
                            <div id="movementsGrid" class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                <!-- Se llena dinámicamente con JavaScript -->
                                <!-- Las columnas se ajustan con media queries en el style -->
                            </div>
                        </div>
                    </div>
                    <script>
                        // Renderizar inicial
                        renderMovements();
                    </script>
                </body>
                </html>
            `);
            newWindow.document.close();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-2 md:p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] min-[1200px]:grid-cols-1 2xl:grid-cols-1 gap-4 px-2 2xl:px-[2vw] mx-auto">
                {/* Columna lateral: Caja y Filtros */}
                <aside className="space-y-4 min-[1200px]:hidden">
                    {/* Saldo actual (visible siempre) */}
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <h3 className="text-2xl font-bold text-gray-700 mb-2">Caja</h3>
                        <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">SALDO ACTUAL</p>
                            <p className={`text-3xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${currentBalance.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Filtros - Desktop (solo en pantallas <1200px) */}
                    <div className="bg-white rounded-lg shadow-md p-3 overflow-y-auto max-h-[calc(100vh-180px)] hidden lg:block min-[1200px]:hidden">
                        <h3 className="text-md font-bold text-gray-700 mb-3">� Filtros</h3>
                        

                        {/* Fila 1: Orden + Select Descripción (desktop >=1240px) / Orden + Métodos de Pago (tablets 700px-1239px) */}
                        <div className="flex gap-2 mb-3 flex-col min-[1240px]:flex-row">
                            {/* Orden */}
                            <div className="w-auto min-w-[140px] max-w-[160px]">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">ORDEN</label>
                                <select
                                    value={cashSortOrder}
                                    onChange={e => setCashSortOrder(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                >
                                    <option value="desc">Más nuevos primero</option>
                                    <option value="asc">Más viejos primero</option>
                                </select>
                            </div>

                            {/* Métodos de Pago: SOLO visible en tablets (700px-1239px) al lado de Orden */}
                            <div className="hidden min-[700px]:flex min-[1240px]:hidden flex-1 items-end">
                                <div className="w-full">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">MÉTODOS DE PAGO</label>
                                    <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                        {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                            <label key={method} className="flex items-center gap-1.5 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={cashPaymentMethodFilter.includes(method)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setCashPaymentMethodFilter([...cashPaymentMethodFilter, method]);
                                                        } else {
                                                            setCashPaymentMethodFilter(cashPaymentMethodFilter.filter(m => m !== method));
                                                        }
                                                    }}
                                                    className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm capitalize">{method}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Select Descripción: SOLO visible en desktop >=1240px al lado de Orden */}
                            <div className="hidden min-[1240px]:flex flex-1">
                                <div className="w-full">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">DESCRIPCIÓN</label>
                                    <select 
                                        value={cashDescriptionFilterOp} 
                                        onChange={e => setCashDescriptionFilterOp(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    >
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Fila 2: Select Descripción (tablets <1240px) */}
                        <div className="mb-3 min-[1240px]:hidden">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">DESCRIPCIÓN</label>
                            <select 
                                value={cashDescriptionFilterOp} 
                                onChange={e => setCashDescriptionFilterOp(e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                        </div>

                        {/* Fila 3: Input Descripción */}
                        <div className="mb-3">
                            <input 
                                type="text" 
                                value={cashDescriptionFilter} 
                                onChange={e => setCashDescriptionFilter(e.target.value)}
                                placeholder="Ingrese descripción..."
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Fila 4: Métodos de Pago (desktop >=1240px) */}
                        <div className="mb-3 hidden min-[1240px]:block">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">MÉTODOS DE PAGO</label>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                    <label key={method} className="flex items-center gap-1.5 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={cashPaymentMethodFilter.includes(method)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setCashPaymentMethodFilter([...cashPaymentMethodFilter, method]);
                                                } else {
                                                    setCashPaymentMethodFilter(cashPaymentMethodFilter.filter(m => m !== method));
                                                }
                                            }}
                                            className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm capitalize">{method}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Fila 5: Monto */}
                        <div className="mb-3">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">MONTO</label>
                            <div className="flex gap-2">
                                <select 
                                    value={cashAmountFilterOp} 
                                    onChange={e => setCashAmountFilterOp(e.target.value)}
                                    className="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[120px]"
                                >
                                    <option value="equals">Es igual</option>
                                    <option value="lt">Es menor que</option>
                                    <option value="lte">Es menor o igual</option>
                                    <option value="gt">Es mayor que</option>
                                    <option value="gte">Es mayor o igual</option>
                                </select>
                                <input 
                                    type="number" 
                                    value={cashAmountFilter} 
                                    onChange={e => setCashAmountFilter(e.target.value)}
                                    placeholder="Monto..."
                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[80px]"
                                />
                            </div>
                        </div>

                        {/* Fila 6: Filtros de Fecha - Optimizados */}
                        <div className="mb-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">FECHAS</label>
                            
                            {/* Desde */}
                            <div className="flex items-center gap-1 mb-2">
                                <span className="text-xs font-medium text-gray-600 min-w-[50px]">Desde:</span>
                                <input 
                                    type="number" 
                                    value={cashDateFromYear} 
                                    onChange={e => setCashDateFromYear(e.target.value)}
                                    placeholder="Año"
                                    min="2000"
                                    max="2100"
                                    className="w-16 min-w-[60px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateFromMonth} 
                                    onChange={e => setCashDateFromMonth(e.target.value)}
                                    placeholder="Mes"
                                    min="1"
                                    max="12"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateFromDay} 
                                    onChange={e => setCashDateFromDay(e.target.value)}
                                    placeholder="Día"
                                    min="1"
                                    max="31"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateFromHour} 
                                    onChange={e => setCashDateFromHour(e.target.value)}
                                    placeholder="Hora"
                                    min="0"
                                    max="23"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateFromMinute} 
                                    onChange={e => setCashDateFromMinute(e.target.value)}
                                    placeholder="Min"
                                    min="0"
                                    max="59"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                            </div>

                            {/* Hasta */}
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-medium text-gray-600 min-w-[50px]">Hasta:</span>
                                <input 
                                    type="number" 
                                    value={cashDateToYear} 
                                    onChange={e => setCashDateToYear(e.target.value)}
                                    placeholder="Año"
                                    min="2000"
                                    max="2100"
                                    className="w-16 min-w-[60px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateToMonth} 
                                    onChange={e => setCashDateToMonth(e.target.value)}
                                    placeholder="Mes"
                                    min="1"
                                    max="12"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateToDay} 
                                    onChange={e => setCashDateToDay(e.target.value)}
                                    placeholder="Día"
                                    min="1"
                                    max="31"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateToHour} 
                                    onChange={e => setCashDateToHour(e.target.value)}
                                    placeholder="Hora"
                                    min="0"
                                    max="23"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                                <input 
                                    type="number" 
                                    value={cashDateToMinute} 
                                    onChange={e => setCashDateToMinute(e.target.value)}
                                    placeholder="Min"
                                    min="0"
                                    max="59"
                                    className="w-12 min-w-[45px] px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filtros - Móvil/Tablet (acordeón, solo en pantallas <1200px) */}
                    <div className="lg:hidden min-[1200px]:hidden">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="w-full font-bold text-gray-700 bg-white rounded-lg shadow-md p-3 cursor-pointer text-left flex justify-between items-center"
                        >
                            <span>🔍 Filtros</span>
                            <span className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {showFilters && (
                            <div className="bg-white rounded-lg shadow-md p-3 mt-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                                <h3 className="text-md font-bold text-gray-700 mb-3">🔍 Filtros</h3>
                                
                                {/* Fila 1: Orden + Métodos de Pago (tablets 700px-1239px) + Select Descripción (desktop >=1240px) */}
                                <div className="flex flex-col min-[700px]:flex-row min-[1240px]:flex-col gap-2 mb-3">
                                    {/* Orden */}
                                    <div className="w-full min-[700px]:w-auto min-[700px]:min-w-[140px] min-[700px]:max-w-[160px]">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">ORDEN</label>
                                        <select
                                            value={cashSortOrder}
                                            onChange={e => setCashSortOrder(e.target.value)}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        >
                                            <option value="desc">Más nuevos primero</option>
                                            <option value="asc">Más viejos primero</option>
                                        </select>
                                    </div>

                                    {/* Métodos de Pago: mostrarse junto a Orden en tablets (700px-1239px) */}
                                    <div className="hidden min-[700px]:flex min-[1240px]:hidden items-end min-[700px]:flex-1">
                                        <div className="w-full">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">MÉTODOS DE PAGO</label>
                                            <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                                {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                                    <label key={method} className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <input
                                                            type="checkbox"
                                                            checked={cashPaymentMethodFilter.includes(method)}
                                                            onChange={e => {
                                                                if (e.target.checked) {
                                                                    setCashPaymentMethodFilter([...cashPaymentMethodFilter, method]);
                                                                } else {
                                                                    setCashPaymentMethodFilter(cashPaymentMethodFilter.filter(m => m !== method));
                                                                }
                                                            }}
                                                            className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm capitalize">{method}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Select Descripción (desktop >=1240px al lado de Orden) */}
                                    <div className="hidden min-[1240px]:flex flex-1">
                                        <div className="w-full">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">DESCRIPCIÓN</label>
                                            <select 
                                                value={cashDescriptionFilterOp} 
                                                onChange={e => setCashDescriptionFilterOp(e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            >
                                                <option value="contains">Contiene</option>
                                                <option value="equals">Es igual</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Fila 2: Select Descripción (tablets y mobile <1240px, debajo de Orden+Métodos) */}
                                <div className="mb-3 min-[1240px]:hidden">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">DESCRIPCIÓN</label>
                                    <select 
                                        value={cashDescriptionFilterOp} 
                                        onChange={e => setCashDescriptionFilterOp(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    >
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                </div>

                                {/* Fila 3: Input Descripción */}
                                <div className="mb-3">
                                    <input 
                                        type="text" 
                                        value={cashDescriptionFilter} 
                                        onChange={e => setCashDescriptionFilter(e.target.value)}
                                        placeholder="Ingrese descripción..."
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                </div>

                                {/* Fila 4: Métodos de Pago (mobile <700px y desktop >=1240px) */}
                                <div className="mb-3 min-[700px]:hidden min-[1240px]:block">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">MÉTODOS DE PAGO</label>
                                    <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                        {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                            <label key={method} className="flex items-center gap-1.5 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={cashPaymentMethodFilter.includes(method)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setCashPaymentMethodFilter([...cashPaymentMethodFilter, method]);
                                                        } else {
                                                            setCashPaymentMethodFilter(cashPaymentMethodFilter.filter(m => m !== method));
                                                        }
                                                    }}
                                                    className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm capitalize">{method}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Fila 5: Monto */}
                                <div className="mb-3">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">MONTO</label>
                                    <div className="flex flex-col min-[420px]:flex-row gap-2">
                                        <select 
                                            value={cashAmountFilterOp} 
                                            onChange={e => setCashAmountFilterOp(e.target.value)}
                                            className="w-full min-[420px]:w-auto px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-[420px]:min-w-[120px]"
                                        >
                                            <option value="equals">Es igual</option>
                                            <option value="lt">Es menor que</option>
                                            <option value="lte">Es menor o igual</option>
                                            <option value="gt">Es mayor que</option>
                                            <option value="gte">Es mayor o igual</option>
                                        </select>
                                        <input 
                                            type="number" 
                                            value={cashAmountFilter} 
                                            onChange={e => setCashAmountFilter(e.target.value)}
                                            placeholder="Monto..."
                                            className="w-full min-[420px]:flex-1 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-[420px]:min-w-[80px]"
                                        />
                                    </div>
                                </div>

                                {/* Filtros de Fecha - Desde y Hasta */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {/* Fecha Desde */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">DESDE</label>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <input 
                                                type="number" 
                                                value={cashDateFromYear} 
                                                onChange={e => setCashDateFromYear(e.target.value)}
                                                placeholder="Año"
                                                min="2000"
                                                max="2100"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateFromMonth} 
                                                onChange={e => setCashDateFromMonth(e.target.value)}
                                                placeholder="Mes"
                                                min="1"
                                                max="12"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateFromDay} 
                                                onChange={e => setCashDateFromDay(e.target.value)}
                                                placeholder="Día"
                                                min="1"
                                                max="31"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                type="number" 
                                                value={cashDateFromHour} 
                                                onChange={e => setCashDateFromHour(e.target.value)}
                                                placeholder="Hora"
                                                min="0"
                                                max="23"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateFromMinute} 
                                                onChange={e => setCashDateFromMinute(e.target.value)}
                                                placeholder="Min"
                                                min="0"
                                                max="59"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Fecha Hasta */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">HASTA</label>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <input 
                                                type="number" 
                                                value={cashDateToYear} 
                                                onChange={e => setCashDateToYear(e.target.value)}
                                                placeholder="Año"
                                                min="2000"
                                                max="2100"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateToMonth} 
                                                onChange={e => setCashDateToMonth(e.target.value)}
                                                placeholder="Mes"
                                                min="1"
                                                max="12"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateToDay} 
                                                onChange={e => setCashDateToDay(e.target.value)}
                                                placeholder="Día"
                                                min="1"
                                                max="31"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                type="number" 
                                                value={cashDateToHour} 
                                                onChange={e => setCashDateToHour(e.target.value)}
                                                placeholder="Hora"
                                                min="0"
                                                max="23"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <input 
                                                type="number" 
                                                value={cashDateToMinute} 
                                                onChange={e => setCashDateToMinute(e.target.value)}
                                                placeholder="Min"
                                                min="0"
                                                max="59"
                                                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Columna principal: Lista de movimientos (solo visible en <1200px) / Botón en ≥1200px */}
                <main>
                    {/* En pantallas ≥1200px: Saldo actual + Botón */}
                    <div className="hidden min-[1200px]:flex flex-col gap-4 max-w-md mx-auto">
                        {/* Saldo actual */}
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h3 className="text-2xl font-bold text-gray-700 mb-2">Caja</h3>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">SALDO ACTUAL</p>
                                <p className={`text-3xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${currentBalance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        
                        {/* Botón para abrir historial */}
                        <div className="bg-white rounded-lg shadow-md p-4 flex justify-center items-center">
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-lg transition-colors"
                                onClick={() => setShowHistoryDialog(true)}
                            >
                                 Historial de Movimientos de Caja
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-4 min-[1200px]:hidden">
                        {/* En pantallas <1200px: mostrar historial completo */}
                        <div className="min-[1200px]:hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-700">Historial de Movimientos de Caja</h3>
                            </div>
                            
                            {filteredMovements.length === 0 ? (
                                <p className="text-center text-gray-500 py-12">No se encontraron movimientos</p>
                            ) : (
                                <div className="
                                    grid gap-4
                                    grid-cols-1
                                    sm:grid-cols-2
                                    md:grid-cols-2
                                    min-[1020px]:grid-cols-3
                                    max-h-[calc(100vh-200px)]
                                    overflow-y-auto
                                ">
                                    {filteredMovements.map(movement => (
                                        <div 
                                            key={movement.id} 
                                            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors break-words"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs text-gray-500">{formatMovementDate(movement.date)}</span>
                                                <span className="text-lg font-bold text-green-600">${movement.amount.toFixed(2)}</span>
                                            </div>
                                            <div className="font-medium text-gray-800 text-sm">
                                                {movement.description}
                                                {movement.payment_method && (
                                                    <span className="block text-sm text-gray-600 mt-1">
                                                        ({movement.payment_method})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Diálogo pop-up para historial completo (solo ≥1200px) */}
            {showHistoryDialog && (
                <>
                    <div 
                        className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 flex flex-col"
                        style={{
                            left: `${dialogPosition.x}px`,
                            top: `${dialogPosition.y}px`,
                            width: isMinimized ? '300px' : `${dialogSize.width}px`,
                            height: isMinimized ? 'auto' : `${dialogSize.height}px`,
                            zIndex: 1000,
                            minWidth: isMinimized ? '300px' : '800px',
                            minHeight: isMinimized ? 'auto' : '500px',
                            maxWidth: '90vw',
                            maxHeight: isMinimized ? 'auto' : '90vh'
                        }}
                    >
                        {/* Barra de título draggable */}
                        <div 
                            className={`bg-blue-600 text-white px-4 py-3 cursor-move flex justify-between items-center select-none ${isMinimized ? 'min-h-[48px] px-2' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                                setDragStart({ x: e.clientX - dialogPosition.x, y: e.clientY - dialogPosition.y });
                            }}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <h3 className={`font-bold ${isMinimized ? 'text-sm' : 'text-base'} whitespace-normal`}>
                                    Historial de Movimientos de Caja
                                </h3>
                                {!isMinimized && (
                                    <span className="bg-white text-blue-600 px-2 py-1 rounded text-xs font-semibold">
                                        {filteredMovements.length} movimientos
                                    </span>
                                )}
                            </div>
                            <div className={`flex items-center gap-2 flex-shrink-0`}>
                                <button 
                                    className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openInNewWindow();
                                    }}
                                    title="Abrir en pestaña nueva"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                                <button
                                    className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMinimized(!isMinimized);
                                    }}
                                    title={isMinimized ? "Maximizar" : "Minimizar"}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {isMinimized ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        )}
                                    </svg>
                                </button>
                                <button 
                                    className="hover:bg-red-600 p-1.5 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowHistoryDialog(false);
                                        setIsMinimized(false);
                                    }}
                                    title="Cerrar"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Contenido del diálogo */}
                        {!isMinimized && (
                            <>
                                {/* Filtros dentro del diálogo */}
                                <div className="border-b border-gray-200 bg-gray-50 p-3 overflow-y-auto max-h-[300px]">
                                    <h4 className="text-sm font-bold text-gray-700 mb-3">🔍 Filtros</h4>
                                    
                                    {/* Orden y Descripción */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">ORDEN</label>
                                            <select
                                                value={cashSortOrder}
                                                onChange={e => setCashSortOrder(e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            >
                                                <option value="desc">Más nuevos primero</option>
                                                <option value="asc">Más viejos primero</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">DESCRIPCIÓN</label>
                                            <select 
                                                value={cashDescriptionFilterOp} 
                                                onChange={e => setCashDescriptionFilterOp(e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            >
                                                <option value="contains">Contiene</option>
                                                <option value="equals">Es igual</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Input Descripción */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">BUSCAR DESCRIPCIÓN</label>
                                        <input
                                            type="text"
                                            value={cashDescriptionFilter}
                                            onChange={e => setCashDescriptionFilter(e.target.value)}
                                            placeholder="Escribe para buscar..."
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>

                                    {/* Monto */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">OPERACIÓN MONTO</label>
                                            <select
                                                value={cashAmountFilterOp}
                                                onChange={e => setCashAmountFilterOp(e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            >
                                                <option value="equals">Es igual</option>
                                                <option value="lt">Menor que</option>
                                                <option value="lte">Menor o igual</option>
                                                <option value="gt">Mayor que</option>
                                                <option value="gte">Mayor o igual</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">MONTO</label>
                                            <input
                                                type="number"
                                                value={cashAmountFilter}
                                                onChange={e => setCashAmountFilter(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Métodos de pago */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">MÉTODOS DE PAGO</label>
                                        <div className="flex flex-wrap gap-3">
                                            {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                                <label key={method} className="flex items-center gap-1.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={cashPaymentMethodFilter.includes(method)}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setCashPaymentMethodFilter([...cashPaymentMethodFilter, method]);
                                                            } else {
                                                                setCashPaymentMethodFilter(cashPaymentMethodFilter.filter(m => m !== method));
                                                            }
                                                        }}
                                                        className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm capitalize">{method}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Fechas FROM */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">FECHA DESDE</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            <input type="number" placeholder="Año" value={cashDateFromYear} onChange={e => setCashDateFromYear(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Mes" value={cashDateFromMonth} onChange={e => setCashDateFromMonth(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Día" value={cashDateFromDay} onChange={e => setCashDateFromDay(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Hora" value={cashDateFromHour} onChange={e => setCashDateFromHour(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Min" value={cashDateFromMinute} onChange={e => setCashDateFromMinute(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                        </div>
                                    </div>

                                    {/* Fechas TO */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">FECHA HASTA</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            <input type="number" placeholder="Año" value={cashDateToYear} onChange={e => setCashDateToYear(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Mes" value={cashDateToMonth} onChange={e => setCashDateToMonth(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Día" value={cashDateToDay} onChange={e => setCashDateToDay(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Hora" value={cashDateToHour} onChange={e => setCashDateToHour(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                            <input type="number" placeholder="Min" value={cashDateToMinute} onChange={e => setCashDateToMinute(e.target.value)} 
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>

                                {/* Grid de movimientos */}
                                <div className="flex-1 p-4 overflow-y-auto">
                                    {filteredMovements.length === 0 ? (
                                        <p className="text-center text-gray-500 py-12">No se encontraron movimientos</p>
                                    ) : (
                                        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 min-[1200px]:grid-cols-3 min-[1300px]:grid-cols-4 min-[1800px]:grid-cols-5 min-[2400px]:grid-cols-6">
                                            {filteredMovements.map(movement => (
                                                <div 
                                                    key={movement.id} 
                                                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors hover:shadow-md"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-xs text-gray-500">{formatMovementDate(movement.date)}</span>
                                                        <span className="text-base font-bold text-green-600">${movement.amount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="font-medium text-gray-800 text-sm">
                                                        <p className="line-clamp-2">{movement.description}</p>
                                                        {movement.payment_method && (
                                                            <span className="block text-xs text-gray-600 mt-1 capitalize">
                                                                 {movement.payment_method}
                                                            </span>
                                                        )}
                                                        
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Handle de redimensionamiento */}
                                <div 
                                    className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
                                    style={{ 
                                        background: 'linear-gradient(135deg, transparent 0%, transparent 50%, #9CA3AF 50%, #9CA3AF 100%)',
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsResizing(true);
                                        setResizeStart({ width: dialogSize.width, height: dialogSize.height });
                                        setDragStart({ x: e.clientX, y: e.clientY });
                                    }}
                                />
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Movimientos_De_Caja;
