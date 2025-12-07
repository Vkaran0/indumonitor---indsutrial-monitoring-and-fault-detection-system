 // ==================== CONFIGURATION ====================
        const SUPABASE_CONFIG = {
            url: 'https://noyfimgffaccelemollp.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWZpbWdmZmFjY2VsZW1vbGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDM1NTMsImV4cCI6MjA4MDA3OTU1M30.xhjHnWFpLxpFVnMStu2kveN4Ch_qtabNT5FUIIAJw7o'
        };

        const TABLE_NAMES = {
            readings: 'readings',
            dht11: 'dht11_readings',
            hall: 'hall_readings',
            mq135: 'mq135_readings',
            ir: 'ir_readings',
            bmp280: 'bmp280_readings',
            rf_noise: 'rf_noise_log',
            relay_status: 'relay_status'
        };

        // ==================== INITIALIZATION ====================
        let supabase;
        let charts = {};
        let detailCharts = {};
        let lastUpdateTime = new Date();
        let currentPage = 1;
        const pageSize = 20;
        let systemStartTime = new Date();
        
        // Air quality calculation constants
        const AIR_QUALITY_CONSTANTS = {
            // Base values for calculation
            CO2_BASE: 400,
            CO2_MULTIPLIER: 10,
            SMOKE_BASE: 0,
            SMOKE_MULTIPLIER: 0.5,
            O2_BASE: 20.9,
            O2_MULTIPLIER: 0.01,
            CO_BASE: 0,
            CO_MULTIPLIER: 0.1
        };

        // Set current date to December 6, 2025 for demo
        const CURRENT_YEAR = 2025;
        const CURRENT_MONTH = 11; // December (0-indexed)
        const CURRENT_DAY = 6;

        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Starting IoT Dashboard...');
            
            // Initialize Supabase
            supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            
            // Initialize charts
            initializeCharts();
            
            // Setup real-time subscriptions
            setupRealtimeSubscriptions();
            
            // Fetch initial data
            fetchInitialData();
            
            // Start timers with December 6, 2025 date
            updateCurrentTime();
            setInterval(updateCurrentTime, 1000);
            setInterval(updateLastUpdated, 5000);
            setInterval(updateUptime, 60000);
            
            // Initialize system status
            updateUptime();
            checkRelayStatus();
            
            console.log('✅ Dashboard initialized successfully!');
        });

        // ==================== UTILITY FUNCTIONS ====================
        function convertToIndianTime(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            
            // Add 5 hours 30 minutes for Indian Standard Time (IST)
            date.setHours(date.getHours() + 5);
            date.setMinutes(date.getMinutes() + 30);
            
            // Set to December 6, 2025 for demo purposes
            date.setFullYear(CURRENT_YEAR);
            date.setMonth(CURRENT_MONTH);
            date.setDate(CURRENT_DAY);
            
            return date;
        }

        function formatDateTime(dateString) {
            if (!dateString) return 'N/A';
            const date = convertToIndianTime(dateString);
            return date.toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }

        function formatTime(dateString) {
            if (!dateString) return 'N/A';
            const date = convertToIndianTime(dateString);
            return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }

        function getTimeFromTimestamp(timestamp) {
            if (!timestamp) return '';
            try {
                const date = convertToIndianTime(timestamp);
                return date.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            } catch (e) {
                console.log('Error parsing time:', timestamp, e);
                return '';
            }
        }

        // ==================== CHART INITIALIZATION ====================
        function initializeCharts() {
            // Line charts for all sensors
            const lineCharts = ['tempChart', 'humidityChart', 'currentChart', 'voltageChart', 'airChart', 'pressureChart', 'rfChart'];
            const colors = ['#ff6b6b', '#3498db', '#2ecc71', '#f39c12', '#7f8c8d', '#9b59b6', '#e74c3c'];
            
            lineCharts.forEach((chartId, index) => {
                charts[chartId] = createLineChart(chartId, colors[index]);
            });

            // Radar charts for digital sensors
            charts.magnetRadarChart = createRadarChart('magnetRadarChart', '#3498db');
            charts.irRadarChart = createRadarChart('irRadarChart', '#f39c12');
            charts.fireRadarChart = createRadarChart('fireRadarChart', '#e74c3c');
        }

        function createLineChart(canvasId, color) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: canvasId.replace('Chart', ''),
                        data: [],
                        borderColor: color,
                        backgroundColor: color + '20',
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }
                    },
                    scales: {
                        x: { 
                            display: false 
                        },
                        y: { 
                            display: false,
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        function createRadarChart(canvasId, color) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            return new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['State', 'Activity', 'Frequency', 'Duration', 'Stability'],
                    datasets: [{
                        data: [1, 1, 1, 1, 1],
                        backgroundColor: color + '20',
                        borderColor: color,
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 1,
                            ticks: { display: false }
                        }
                    }
                }
            });
        }

        // ==================== DETAIL MODAL CHARTS ====================
        function createDetailChart(canvasId, data, labels, title, color) {
            const canvas = document.createElement('canvas');
            canvas.id = 'detail-' + canvasId;
            canvas.className = 'detail-chart-container';
            
            const ctx = canvas.getContext('2d');
            
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: title,
                        data: data,
                        borderColor: color,
                        backgroundColor: color + '20',
                        borderWidth: 3,
                        pointRadius: 3,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        title: {
                            display: true,
                            text: title + ' History',
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: true
                            },
                            ticks: {
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                display: true
                            }
                        }
                    }
                }
            });
        }

        // ==================== REAL-TIME UPDATES ====================
        function setupRealtimeSubscriptions() {
            // Temperature/Humidity
            supabase.channel('dht11-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.dht11
                }, payload => {
                    console.log('🌡️ New temperature data:', payload.new);
                    updateTemperature(payload.new);
                })
                .subscribe();

            // Current/Voltage
            supabase.channel('current-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.readings
                }, payload => {
                    console.log('⚡ New current data:', payload.new);
                    updateCurrentVoltage(payload.new);
                })
                .subscribe();

            // Hall Sensor (Magnet)
            supabase.channel('hall-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.hall
                }, payload => {
                    console.log('🧲 New magnet data:', payload.new);
                    updateMagnetSensor(payload.new);
                })
                .subscribe();

            // IR Sensor
            supabase.channel('ir-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.ir
                }, payload => {
                    console.log('📡 New IR data:', payload.new);
                    updateIRSensor(payload.new);
                })
                .subscribe();

            // Air Quality (MQ135)
            supabase.channel('mq135-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.mq135
                }, payload => {
                    console.log('💨 New air quality data:', payload.new);
                    updateAirQuality(payload.new);
                })
                .subscribe();

            // Pressure (BMP280)
            supabase.channel('bmp280-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.bmp280
                }, payload => {
                    console.log('📊 New pressure data:', payload.new);
                    updatePressure(payload.new);
                })
                .subscribe();

            // RF Noise
            supabase.channel('rf-noise-channel')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAMES.rf_noise
                }, payload => {
                    console.log('📶 New RF noise data:', payload.new);
                    updateRFNoise(payload.new);
                })
                .subscribe();

            // Relay Status Monitoring
            supabase.channel('relay-channel')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: TABLE_NAMES.relay_status
                }, payload => {
                    console.log('🔌 Relay status update:', payload.new);
                    updateRelayStatus(payload.new);
                })
                .subscribe();
        }

        // ==================== DATA UPDATES ====================
        function updateTemperature(data) {
            if (data && data.temperature !== null && data.temperature !== undefined) {
                document.getElementById('temp-value').textContent = data.temperature.toFixed(1) + '°C';
                updateChartData(charts.tempChart, data.temperature, data.created_at);
            }
            if (data && data.humidity !== null && data.humidity !== undefined) {
                document.getElementById('humidity-value').textContent = data.humidity.toFixed(1) + '%';
                updateChartData(charts.humidityChart, data.humidity, data.created_at);
            }
            lastUpdateTime = new Date();
        }

        function updateCurrentVoltage(data) {
            if (data && data.current !== null && data.current !== undefined) {
                document.getElementById('current-value').textContent = data.current.toFixed(2) + ' A';
                updateChartData(charts.currentChart, data.current, data.created_at);
            }
            if (data && data.voltage !== null && data.voltage !== undefined) {
                document.getElementById('voltage-value').textContent = data.voltage.toFixed(0) + ' V';
                updateChartData(charts.voltageChart, data.voltage, data.created_at);
            }
            lastUpdateTime = new Date();
        }

        function updateMagnetSensor(data) {
            if (!data) return;
            
            const isPresent = data.magnet_present === 1;
            const statusText = isPresent ? 'PRESENT' : 'ABSENT';
            const badgeClass = isPresent ? 'badge-on' : 'badge-off';
            
            document.getElementById('magnet-status').innerHTML = 
                `<span class="status-badge ${badgeClass}">${statusText}</span>`;
            
            // Update radar chart
            if (charts.magnetRadarChart && charts.magnetRadarChart.data && charts.magnetRadarChart.data.datasets) {
                charts.magnetRadarChart.data.datasets[0].data = isPresent ? 
                    [1, 0.8, 0.6, 0.7, 0.9] : [0.2, 0.3, 0.1, 0.2, 0.1];
                charts.magnetRadarChart.update();
            }
        }

        function updateIRSensor(data) {
            if (!data) return;
            
            const isPresent = data.object_present === 1;
            const statusText = isPresent ? 'DETECTED' : 'CLEAR';
            const badgeClass = isPresent ? 'badge-warning' : 'badge-clear';
            
            document.getElementById('ir-status').innerHTML = 
                `<span class="status-badge ${badgeClass}">${statusText}</span>`;
            
            // Update radar chart
            if (charts.irRadarChart && charts.irRadarChart.data && charts.irRadarChart.data.datasets) {
                charts.irRadarChart.data.datasets[0].data = isPresent ? 
                    [0.9, 0.7, 0.8, 0.6, 0.7] : [0.1, 0.2, 0.1, 0.3, 0.2];
                charts.irRadarChart.update();
            }
        }

        function updateAirQuality(data) {
            if (!data) return;
            
            const adcValue = data.adc_value || 0;
            document.getElementById('air-value').textContent = adcValue;
            
            // Calculate air quality parameters from ADC value
            const airQuality = calculateAirQuality(adcValue);
            
            updateChartData(charts.airChart, adcValue, data.created_at);
        }

        function calculateAirQuality(adcValue) {
            // Convert ADC value to various air quality parameters
            // This is a simplified calculation - adjust based on your sensor calibration
            return {
                co2: AIR_QUALITY_CONSTANTS.CO2_BASE + (adcValue * AIR_QUALITY_CONSTANTS.CO2_MULTIPLIER),
                smoke: AIR_QUALITY_CONSTANTS.SMOKE_BASE + (adcValue * AIR_QUALITY_CONSTANTS.SMOKE_MULTIPLIER),
                o2: Math.max(19.5, AIR_QUALITY_CONSTANTS.O2_BASE - (adcValue * AIR_QUALITY_CONSTANTS.O2_MULTIPLIER)),
                co: AIR_QUALITY_CONSTANTS.CO_BASE + (adcValue * AIR_QUALITY_CONSTANTS.CO_MULTIPLIER),
                tvoc: adcValue * 0.2,
                pm25: adcValue * 0.1
            };
        }

        function updatePressure(data) {
            if (!data || data.pressure_hpa === null || data.pressure_hpa === undefined) return;
            
            document.getElementById('pressure-value').textContent = data.pressure_hpa.toFixed(1) + ' hPa';
            updateChartData(charts.pressureChart, data.pressure_hpa, data.created_at);
        }

        function updateRFNoise(data) {
            if (!data) return;
            
            const noisePercent = data.noise_percent || 0;
            document.getElementById('rf-value').textContent = noisePercent.toFixed(1) + '%';
            
            // Update progress bar
            const progressBar = document.getElementById('rf-progress-bar');
            progressBar.style.width = `${noisePercent}%`;
            progressBar.textContent = `${noisePercent.toFixed(1)}%`;
            
            // Color coding
            if (noisePercent > 70) {
                progressBar.className = 'progress-bar bg-danger';
            } else if (noisePercent > 40) {
                progressBar.className = 'progress-bar bg-warning';
            } else {
                progressBar.className = 'progress-bar bg-success';
            }
            
            const timestamp = data.measured_at || data.created_at || new Date().toISOString();
            updateChartData(charts.rfChart, noisePercent, timestamp);
        }

        function updateChartData(chart, value, timestamp) {
            if (!chart || !chart.data || !chart.data.datasets || chart.data.datasets.length === 0) return;
            
            const labels = chart.data.labels || [];
            const data = chart.data.datasets[0].data || [];
            
            // Use the exact time from database converted to IST
            const displayTime = getTimeFromTimestamp(timestamp);
            
            // Add new data point
            labels.push(displayTime);
            data.push(value);
            
            // Keep only last 10 points
            if (labels.length > 10) {
                labels.shift();
                data.shift();
            }
            
            try {
                chart.update();
            } catch (e) {
                console.log('Chart update error:', e);
            }
        }

        // ==================== RELAY STATUS MANAGEMENT ====================
        async function checkRelayStatus() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.relay_status)
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!error && data) {
                    updateRelayStatus(data);
                }
            } catch (error) {
                console.error('Error checking relay status:', error);
            }
        }

        function updateRelayStatus(data) {
            if (!data) return;
            
            const statusElement = document.getElementById('relay-status');
            if (data.status === 'FAULT') {
                statusElement.textContent = 'FAULT';
                statusElement.className = 'text-danger';
            } else {
                statusElement.textContent = 'NORMAL';
                statusElement.className = 'text-success';
            }
        }

        // ==================== LOGOUT FUNCTION ====================
        function logout() {
            if (confirm('Are you sure you want to logout?')) {
                // Close all real-time subscriptions
                if (supabase) {
                    const channels = [
                        'dht11-channel',
                        'current-channel',
                        'hall-channel',
                        'ir-channel',
                        'mq135-channel',
                        'bmp280-channel',
                        'rf-noise-channel',
                        'relay-channel'
                    ];
                    
                    channels.forEach(channel => {
                        supabase.removeChannel(channel);
                    });
                }
                
                // Show logout message
                alert('Logged out successfully!');
                
                // Close the current tab/window
                window.close();
                
                // If window.close() doesn't work, redirect to about:blank
                setTimeout(() => {
                    window.location.href = 'about:blank';
                }, 1000);
            }
        }

        // ==================== INITIAL DATA FETCH ====================
        async function fetchInitialData() {
            try {
                console.log('📊 Fetching initial data...');
                
                // Fetch latest temperature
                const { data: tempData, error: tempError } = await supabase
                    .from(TABLE_NAMES.dht11)
                    .select('temperature, humidity, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!tempError && tempData) {
                    updateTemperature(tempData);
                } else {
                    console.log('No temperature data available');
                }

                // Fetch latest current/voltage
                const { data: currentData, error: currentError } = await supabase
                    .from(TABLE_NAMES.readings)
                    .select('current, voltage, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!currentError && currentData) {
                    updateCurrentVoltage(currentData);
                } else {
                    console.log('No current/voltage data available');
                }

                // Fetch latest magnet status
                const { data: magnetData, error: magnetError } = await supabase
                    .from(TABLE_NAMES.hall)
                    .select('magnet_present, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!magnetError && magnetData) {
                    updateMagnetSensor(magnetData);
                } else {
                    console.log('No magnet data available');
                }

                // Fetch latest IR status
                const { data: irData, error: irError } = await supabase
                    .from(TABLE_NAMES.ir)
                    .select('object_present, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!irError && irData) {
                    updateIRSensor(irData);
                } else {
                    console.log('No IR data available');
                }

                // Fetch latest air quality
                const { data: airData, error: airError } = await supabase
                    .from(TABLE_NAMES.mq135)
                    .select('adc_value, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!airError && airData) {
                    updateAirQuality(airData);
                } else {
                    console.log('No air quality data available');
                }

                // Fetch latest pressure
                const { data: pressureData, error: pressureError } = await supabase
                    .from(TABLE_NAMES.bmp280)
                    .select('pressure_hpa, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!pressureError && pressureData) {
                    updatePressure(pressureData);
                } else {
                    console.log('No pressure data available');
                }

                // Fetch latest RF noise
                const { data: rfData, error: rfError } = await supabase
                    .from(TABLE_NAMES.rf_noise)
                    .select('noise_percent, measured_at, created_at')
                    .order('measured_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!rfError && rfData) {
                    updateRFNoise(rfData);
                } else {
                    console.log('No RF noise data available');
                }

                // Update connection status
                document.getElementById('connection-status').textContent = 'Connected to Supabase | Real-time updates active';
                document.querySelector('.connection-status').className = 'connection-status';
                
                console.log('✅ Initial data loaded successfully!');
                
            } catch (error) {
                console.error('❌ Error fetching initial data:', error);
                document.getElementById('connection-status').textContent = 'Error connecting to Supabase | Check console';
                document.querySelector('.connection-status').style.background = 'linear-gradient(135deg, #ff6b6b 0%, #c44569 100%)';
            }
        }

        // ==================== DETAILS MODAL FUNCTIONS ====================
        async function showDetails(sensorType) {
            const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalContent');
            
            let title = '';
            let html = '';
            
            switch(sensorType) {
                case 'temperature':
                    title = 'Temperature Data & Analysis';
                    html = await getTemperatureDetails();
                    break;
                case 'humidity':
                    title = 'Humidity Data & Analysis';
                    html = await getHumidityDetails();
                    break;
                case 'current':
                    title = 'Current Data & Analysis';
                    html = await getCurrentDetails();
                    break;
                case 'voltage':
                    title = 'Voltage Data & Analysis';
                    html = await getVoltageDetails();
                    break;
                case 'air':
                    title = 'Air Quality Data & Analysis';
                    html = await getAirQualityDetails();
                    break;
                case 'pressure':
                    title = 'Pressure Data & Analysis';
                    html = await getPressureDetails();
                    break;
                case 'magnet':
                    title = 'Magnet Sensor Data & Analysis';
                    html = await getMagnetDetails();
                    break;
                case 'ir':
                    title = 'IR Sensor Data & Analysis';
                    html = await getIRDetails();
                    break;
                case 'fire':
                    title = 'Fire Sensor Data & Analysis';
                    html = await getFireDetails();
                    break;
                case 'rf':
                    title = 'RF Noise Data & Analysis';
                    html = await getRFDetails();
                    break;
            }
            
            modalTitle.textContent = title;
            modalContent.innerHTML = html;
            modal.show();
            
            // Initialize detail chart after content is loaded
            setTimeout(() => {
                initializeDetailChart(sensorType);
            }, 100);
        }

        async function initializeDetailChart(sensorType) {
            try {
                // Fetch historical data for the chart
                const { data, error } = await supabase
                    .from(getTableName(sensorType))
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error || !data) return;
                
                // Prepare data for chart
                const chartData = [];
                const labels = [];
                let title = '';
                let color = '#3498db';
                
                data.forEach(item => {
                    // Use the exact time from database converted to IST
                    const displayTime = getTimeFromTimestamp(item.created_at);
                    labels.unshift(displayTime); // Reverse order for chronological display
                    
                    switch(sensorType) {
                        case 'temperature':
                            chartData.unshift(item.temperature);
                            title = 'Temperature';
                            color = '#ff6b6b';
                            break;
                        case 'humidity':
                            chartData.unshift(item.humidity);
                            title = 'Humidity';
                            color = '#3498db';
                            break;
                        case 'current':
                            chartData.unshift(item.current);
                            title = 'Current';
                            color = '#2ecc71';
                            break;
                        case 'voltage':
                            chartData.unshift(item.voltage);
                            title = 'Voltage';
                            color = '#f39c12';
                            break;
                        case 'air':
                            chartData.unshift(item.adc_value || 0);
                            title = 'Air Quality (ADC)';
                            color = '#7f8c8d';
                            break;
                        case 'pressure':
                            chartData.unshift(item.pressure_hpa);
                            title = 'Pressure';
                            color = '#9b59b6';
                            break;
                        case 'rf':
                            chartData.unshift(item.noise_percent || 0);
                            title = 'RF Noise';
                            color = '#e74c3c';
                            break;
                    }
                });
                
                // Create the chart
                const chartId = sensorType + '-detail-chart';
                if (detailCharts[chartId]) {
                    detailCharts[chartId].destroy();
                }
                
                detailCharts[chartId] = createDetailChart(chartId, chartData, labels, title, color);
                
            } catch (error) {
                console.error('Error creating detail chart:', error);
            }
        }

        function getTableName(sensorType) {
            switch(sensorType) {
                case 'temperature':
                case 'humidity':
                    return TABLE_NAMES.dht11;
                case 'current':
                case 'voltage':
                    return TABLE_NAMES.readings;
                case 'magnet':
                    return TABLE_NAMES.hall;
                case 'ir':
                case 'fire':
                    return TABLE_NAMES.ir;
                case 'air':
                    return TABLE_NAMES.mq135;
                case 'pressure':
                    return TABLE_NAMES.bmp280;
                case 'rf':
                    return TABLE_NAMES.rf_noise;
                default:
                    return TABLE_NAMES.readings;
            }
        }

        async function getTemperatureDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.dht11)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const temperatures = data.map(d => d.temperature).filter(t => t !== null);
                const avgTemp = temperatures.length > 0 ? 
                    (temperatures.reduce((a, b) => a + b) / temperatures.length).toFixed(2) : 'N/A';
                const maxTemp = temperatures.length > 0 ? Math.max(...temperatures).toFixed(2) : 'N/A';
                const minTemp = temperatures.length > 0 ? Math.min(...temperatures).toFixed(2) : 'N/A';
                
                // Generate HTML
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-chart-bar"></i> Temperature Analysis</h6>
                        <div class="row">
                            <div class="col-md-4">
                                <strong>Total Readings:</strong><br>
                                <span class="text-primary">${data.length}</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Average Temperature:</strong><br>
                                <span class="text-danger">${avgTemp}°C</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Temperature Range:</strong><br>
                                <span>${minTemp}°C to ${maxTemp}°C</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="temperature-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Temperature (°C)</th>
                                    <th>Humidity (%)</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.temperature !== null ? row.temperature.toFixed(2) : 'N/A'}</td>
                            <td>${row.humidity !== null ? row.humidity.toFixed(2) : 'N/A'}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getAirQualityDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.mq135)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate air quality parameters for latest reading
                const latestReading = data[0];
                const airQuality = latestReading ? calculateAirQuality(latestReading.adc_value || 0) : null;
                
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-wind"></i> Air Quality Analysis</h6>
                        <p>Showing last 50 readings (December 6, 2025)</p>
                    </div>
                    
                    <div class="air-quality-grid">
                        <div class="air-quality-item" style="border-left-color: #e74c3c;">
                            <div class="air-quality-label">CO₂</div>
                            <div class="air-quality-value">${airQuality ? airQuality.co2.toFixed(1) : '--'}</div>
                            <small>ppm</small>
                        </div>
                        <div class="air-quality-item" style="border-left-color: #7f8c8d;">
                            <div class="air-quality-label">Smoke</div>
                            <div class="air-quality-value">${airQuality ? airQuality.smoke.toFixed(2) : '--'}</div>
                            <small>mg/m³</small>
                        </div>
                        <div class="air-quality-item" style="border-left-color: #2ecc71;">
                            <div class="air-quality-label">O₂</div>
                            <div class="air-quality-value">${airQuality ? airQuality.o2.toFixed(1) : '--'}</div>
                            <small>%</small>
                        </div>
                        <div class="air-quality-item" style="border-left-color: #e67e22;">
                            <div class="air-quality-label">CO</div>
                            <div class="air-quality-value">${airQuality ? airQuality.co.toFixed(2) : '--'}</div>
                            <small>ppm</small>
                        </div>
                        <div class="air-quality-item" style="border-left-color: #9b59b6;">
                            <div class="air-quality-label">TVOC</div>
                            <div class="air-quality-value">${airQuality ? airQuality.tvoc.toFixed(2) : '--'}</div>
                            <small>ppb</small>
                        </div>
                        <div class="air-quality-item" style="border-left-color: #34495e;">
                            <div class="air-quality-label">PM2.5</div>
                            <div class="air-quality-value">${airQuality ? airQuality.pm25.toFixed(2) : '--'}</div>
                            <small>µg/m³</small>
                        </div>
                    </div>
                    
                    <div id="air-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>ADC Value</th>
                                    <th>CO₂ (ppm)</th>
                                    <th>O₂ (%)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    const aq = calculateAirQuality(row.adc_value || 0);
                    let statusClass = 'bg-success';
                    let statusText = 'Good';
                    
                    if (aq.co2 > 1000) {
                        statusClass = 'bg-danger';
                        statusText = 'Poor';
                    } else if (aq.co2 > 800) {
                        statusClass = 'bg-warning';
                        statusText = 'Moderate';
                    }
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.adc_value || 'N/A'}</td>
                            <td>${aq.co2.toFixed(1)}</td>
                            <td>${aq.o2.toFixed(1)}</td>
                            <td><span class="badge ${statusClass}">${statusText}</span></td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getIRDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.ir)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const detectedCount = data.filter(d => d.object_present === 1).length;
                const clearCount = data.length - detectedCount;
                const detectedPercentage = data.length > 0 ? 
                    ((detectedCount / data.length) * 100).toFixed(1) : '0';
                
                // Generate HTML
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-infinity"></i> IR Sensor Analysis</h6>
                        <div class="row">
                            <div class="col-md-3">
                                <strong>Total Readings:</strong><br>
                                <span class="text-primary">${data.length}</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Object Detected:</strong><br>
                                <span class="text-warning">${detectedCount} times</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Clear Readings:</strong><br>
                                <span class="text-success">${clearCount} times</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Detection Percentage:</strong><br>
                                <span class="text-info">${detectedPercentage}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Object Present</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    const status = row.object_present === 1 ? 
                        '<span class="badge bg-warning">DETECTED</span>' : 
                        '<span class="badge bg-success">CLEAR</span>';
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.object_present}</td>
                            <td>${status}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getFireDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.ir)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const fireCount = data.filter(d => d.object_present === 1).length;
                const clearCount = data.length - fireCount;
                const firePercentage = data.length > 0 ? 
                    ((fireCount / data.length) * 100).toFixed(1) : '0';
                
                // Generate HTML
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-fire"></i> Fire Sensor Analysis</h6>
                        <div class="row">
                            <div class="col-md-3">
                                <strong>Total Readings:</strong><br>
                                <span class="text-primary">${data.length}</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Fire Detected:</strong><br>
                                <span class="text-danger">${fireCount} times</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Clear Readings:</strong><br>
                                <span class="text-success">${clearCount} times</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Fire Percentage:</strong><br>
                                <span class="text-warning">${firePercentage}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Object Present</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    const status = row.object_present === 1 ? 
                        '<span class="badge bg-danger">FIRE DETECTED</span>' : 
                        '<span class="badge bg-success">CLEAR</span>';
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.object_present}</td>
                            <td>${status}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getRFDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.rf_noise)
                    .select('*')
                    .order('measured_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const noiseValues = data.map(d => d.noise_percent).filter(n => n !== null);
                const avgNoise = noiseValues.length > 0 ? 
                    (noiseValues.reduce((a, b) => a + b) / noiseValues.length).toFixed(2) : 'N/A';
                const maxNoise = noiseValues.length > 0 ? Math.max(...noiseValues).toFixed(2) : 'N/A';
                const minNoise = noiseValues.length > 0 ? Math.min(...noiseValues).toFixed(2) : 'N/A';
                
                // Generate HTML
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-signal"></i> RF Noise Analysis</h6>
                        <div class="row">
                            <div class="col-md-3">
                                <strong>Total Readings:</strong><br>
                                <span class="text-primary">${data.length}</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Average Noise:</strong><br>
                                <span class="text-info">${avgNoise}%</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Maximum Noise:</strong><br>
                                <span class="text-danger">${maxNoise}%</span>
                            </div>
                            <div class="col-md-3">
                                <strong>Minimum Noise:</strong><br>
                                <span class="text-success">${minNoise}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="rf-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Channel</th>
                                    <th>Noise (%)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const timestamp = row.measured_at || row.created_at;
                    const date = formatDateTime(timestamp);
                    const noise = row.noise_percent || 0;
                    let statusClass = 'bg-success';
                    let statusText = 'Low';
                    
                    if (noise > 70) {
                        statusClass = 'bg-danger';
                        statusText = 'Critical';
                    } else if (noise > 40) {
                        statusClass = 'bg-warning';
                        statusText = 'High';
                    } else if (noise > 20) {
                        statusClass = 'bg-info';
                        statusText = 'Medium';
                    }
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.channel || 'N/A'}</td>
                            <td>${noise.toFixed(2)}</td>
                            <td><span class="badge ${statusClass}">${statusText}</span></td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getMagnetDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.hall)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const presentCount = data.filter(d => d.magnet_present === 1).length;
                const absentCount = data.length - presentCount;
                const presentPercentage = data.length > 0 ? 
                    ((presentCount / data.length) * 100).toFixed(1) : '0';
                
                // Generate HTML
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-magnet"></i> Magnet Sensor Analysis</h6>
                        <div class="row">
                            <div class="col-md-4">
                                <strong>Total Readings:</strong><br>
                                <span class="text-primary">${data.length}</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Magnet Present:</strong><br>
                                <span class="text-success">${presentCount} times</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Present Percentage:</strong><br>
                                <span class="text-info">${presentPercentage}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Magnet Present</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    const status = row.magnet_present === 1 ? 
                        '<span class="badge bg-success">PRESENT</span>' : 
                        '<span class="badge bg-secondary">ABSENT</span>';
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.magnet_present}</td>
                            <td>${status}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getCurrentDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.readings)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const currents = data.map(d => d.current).filter(c => c !== null);
                const voltages = data.map(d => d.voltage).filter(v => v !== null);
                
                const avgCurrent = currents.length > 0 ? 
                    (currents.reduce((a, b) => a + b) / currents.length).toFixed(3) : 'N/A';
                const avgVoltage = voltages.length > 0 ? 
                    (voltages.reduce((a, b) => a + b) / voltages.length).toFixed(1) : 'N/A';
                
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-bolt"></i> Current & Voltage Analysis</h6>
                        <div class="row">
                            <div class="col-md-6">
                                <strong>Average Current:</strong><br>
                                <span class="text-success">${avgCurrent} A</span>
                            </div>
                            <div class="col-md-6">
                                <strong>Average Voltage:</strong><br>
                                <span class="text-warning">${avgVoltage} V</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="current-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Current (A)</th>
                                    <th>Voltage (V)</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.current !== null ? row.current.toFixed(3) : 'N/A'}</td>
                            <td>${row.voltage !== null ? row.voltage.toFixed(1) : 'N/A'}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getPressureDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.bmp280)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-tachometer-alt"></i> Pressure Analysis</h6>
                        <p>Showing last 50 readings (December 6, 2025)</p>
                    </div>
                    
                    <div id="pressure-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Pressure (hPa)</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.pressure_hpa !== null ? row.pressure_hpa.toFixed(2) : 'N/A'}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getHumidityDetails() {
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAMES.dht11)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // Calculate statistics
                const humidities = data.map(d => d.humidity).filter(h => h !== null);
                const avgHumidity = humidities.length > 0 ? 
                    (humidities.reduce((a, b) => a + b) / humidities.length).toFixed(2) : 'N/A';
                const maxHumidity = humidities.length > 0 ? Math.max(...humidities).toFixed(2) : 'N/A';
                const minHumidity = humidities.length > 0 ? Math.min(...humidities).toFixed(2) : 'N/A';
                
                let html = `
                    <div class="analysis-box">
                        <h6><i class="fas fa-tint"></i> Humidity Analysis</h6>
                        <div class="row">
                            <div class="col-md-4">
                                <strong>Average Humidity:</strong><br>
                                <span class="text-info">${avgHumidity}%</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Maximum Humidity:</strong><br>
                                <span class="text-primary">${maxHumidity}%</span>
                            </div>
                            <div class="col-md-4">
                                <strong>Minimum Humidity:</strong><br>
                                <span class="text-secondary">${minHumidity}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="humidity-detail-chart-container">
                        <!-- Chart will be inserted here -->
                    </div>
                    
                    <h6 class="mt-4">Historical Data (IST - December 6, 2025)</h6>
                    <div class="data-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date & Time (IST)</th>
                                    <th>Humidity (%)</th>
                                    <th>Temperature (°C)</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                data.forEach(row => {
                    // Use exact timestamp from database converted to IST
                    const date = formatDateTime(row.created_at);
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${row.humidity !== null ? row.humidity.toFixed(2) : 'N/A'}</td>
                            <td>${row.temperature !== null ? row.temperature.toFixed(2) : 'N/A'}</td>
                        </tr>`;
                });
                
                html += `</tbody></table></div>`;
                
                return html;
                
            } catch (error) {
                return `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        async function getVoltageDetails() {
            return await getCurrentDetails();
        }

        // ==================== SENSOR USAGE ANALYTICS ====================
        async function showSensorUsage() {
            const modal = new bootstrap.Modal(document.getElementById('sensorUsageModal'));
            const content = document.getElementById('sensorUsageContent');
            
            try {
                const sensorData = await fetchAllSensorData();
                
                let html = `
                    <div class="sensor-usage-analytics">
                        <h4 class="mb-4"><i class="fas fa-chart-bar"></i> Sensor Usage & Analytics</h4>
                        
                        <div class="row mb-4">
                            <div class="col-md-3 col-6">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h1 class="display-4">9</h1>
                                        <p class="text-muted">Total Sensors</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 col-6">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h1 class="display-4">${sensorData.totalReadings.toLocaleString()}</h1>
                                        <p class="text-muted">Total Readings</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 col-6">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h1 class="display-4">${sensorData.activeSensors}</h1>
                                        <p class="text-muted">Active Sensors</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 col-6">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h1 class="display-4">${sensorData.last24Hours}</h1>
                                        <p class="text-muted">Last 24H Readings</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <h5 class="mb-3">Sensor Details</h5>
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Sensor</th>
                                        <th>Type</th>
                                        <th>Table Name</th>
                                        <th>Total Readings</th>
                                        <th>Latest Reading</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                
                // Add rows for each sensor
                const sensors = [
                    { name: 'Temperature', type: 'Analog', table: 'dht11_readings', key: 'dht11' },
                    { name: 'Humidity', type: 'Analog', table: 'dht11_readings', key: 'dht11' },
                    { name: 'Current', type: 'Analog', table: 'readings', key: 'current' },
                    { name: 'Voltage', type: 'Analog', table: 'readings', key: 'voltage' },
                    { name: 'Air Quality', type: 'Analog', table: 'mq135_readings', key: 'mq135' },
                    { name: 'Pressure', type: 'Analog', table: 'bmp280_readings', key: 'bmp280' },
                    { name: 'Magnet', type: 'Digital', table: 'hall_readings', key: 'hall' },
                    { name: 'IR Sensor', type: 'Digital', table: 'ir_readings', key: 'ir' },
                    { name: 'Fire Sensor', type: 'Digital', table: 'ir_readings', key: 'ir' },
                    { name: 'RF Noise', type: 'Analog', table: 'rf_noise_log', key: 'rf' }
                ];
                
                for (const sensor of sensors) {
                    const data = sensorData[sensor.key];
                    const isActive = data && data.count > 0;
                    
                    html += `
                        <tr>
                            <td><i class="fas fa-sensor me-2"></i> ${sensor.name}</td>
                            <td><span class="badge ${sensor.type === 'Analog' ? 'bg-info' : 'bg-success'}">${sensor.type}</span></td>
                            <td><code>${sensor.table}</code></td>
                            <td>${data ? data.count.toLocaleString() : '0'}</td>
                            <td>${data && data.latest ? formatDateTime(data.latest) : 'No data'}</td>
                            <td><span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                        </tr>`;
                }
                
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                
                content.innerHTML = html;
                modal.show();
                
            } catch (error) {
                content.innerHTML = `<div class="alert alert-danger">Error loading sensor usage data: ${error.message}</div>`;
                modal.show();
            }
        }

        async function fetchAllSensorData() {
            const result = {
                totalReadings: 0,
                activeSensors: 0,
                last24Hours: 0
            };
            
            // Define all sensor queries
            const queries = [
                { key: 'dht11', table: TABLE_NAMES.dht11 },
                { key: 'hall', table: TABLE_NAMES.hall },
                { key: 'mq135', table: TABLE_NAMES.mq135 },
                { key: 'ir', table: TABLE_NAMES.ir },
                { key: 'bmp280', table: TABLE_NAMES.bmp280 },
                { key: 'current', table: TABLE_NAMES.readings },
                { key: 'rf', table: TABLE_NAMES.rf_noise }
            ];
            
            // Calculate time 24 hours ago
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            for (const query of queries) {
                try {
                    // Get total count
                    const { count, error: countError } = await supabase
                        .from(query.table)
                        .select('*', { count: 'exact', head: true });
                    
                    // Get latest reading
                    const { data: latestData, error: latestError } = await supabase
                        .from(query.table)
                        .select('created_at')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    // Get recent count (last 24 hours)
                    const { count: recentCount, error: recentError } = await supabase
                        .from(query.table)
                        .select('*', { count: 'exact', head: true })
                        .gte('created_at', oneDayAgo.toISOString());
                    
                    if (!countError && count > 0) {
                        result[query.key] = {
                            count: count,
                            latest: latestData ? latestData.created_at : null,
                            recentCount: recentCount || 0
                        };
                        result.totalReadings += count;
                        result.activeSensors++;
                        result.last24Hours += recentCount || 0;
                    }
                } catch (error) {
                    console.error(`Error fetching ${query.key} data:`, error);
                }
            }
            
            return result;
        }

        // ==================== UTILITY FUNCTIONS ====================
        function updateCurrentTime() {
            const now = new Date();
            // Set to December 6, 2025
            now.setFullYear(CURRENT_YEAR);
            now.setMonth(CURRENT_MONTH);
            now.setDate(CURRENT_DAY);
            
            document.getElementById('current-time').textContent = 
                now.toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: true 
                });
        }

        function updateLastUpdated() {
            const now = new Date();
            const diff = Math.floor((now - lastUpdateTime) / 1000);
            
            if (diff < 60) {
                document.getElementById('last-updated').textContent = 'Just now';
            } else if (diff < 120) {
                document.getElementById('last-updated').textContent = '1 minute ago';
            } else {
                document.getElementById('last-updated').textContent = `${Math.floor(diff / 60)} minutes ago`;
            }
        }

        function updateUptime() {
            const now = new Date();
            const diff = Math.floor((now - systemStartTime) / 1000);
            
            const days = Math.floor(diff / (3600 * 24));
            const hours = Math.floor((diff % (3600 * 24)) / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            
            document.getElementById('uptime').textContent = `${days}d ${hours}h ${minutes}m`;
        }