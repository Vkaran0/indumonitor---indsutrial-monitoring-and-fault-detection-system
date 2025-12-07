// Supabase Client Configuration
const SUPABASE_URL = 'https://noyfimgffaccelemollp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWZpbWdmZmFjY2VsZW1vbGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDM1NTMsImV4cCI6MjA4MDA3OTU1M30.xhjHnWFpLxpFVnMStu2kveN4Ch_qtabNT5FUIIAJw7o';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Test connection
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('readings')
            .select('*')
            .limit(1);
        
        if (error) throw error;
        
        console.log('Supabase connection successful');
        document.getElementById('connection-status').innerHTML = 
            '<i class="fas fa-wifi"></i> Connected to Database';
        
        return true;
    } catch (error) {
        console.error('Supabase connection failed:', error);
        document.getElementById('connection-status').innerHTML = 
            '<i class="fas fa-wifi-slash"></i> Connection Failed';
        document.getElementById('connection-status').classList.add('status-disconnected');
        return false;
    }
}

// Fetch sensor data
async function fetchSensorData(sensorType, limit = 100, timeRange = '1h') {
    try {
        let query = supabase
            .from(sensorType + '_readings')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Apply time filter
        if (timeRange !== 'all') {
            const now = new Date();
            let startTime;
            
            switch(timeRange) {
                case '1h':
                    startTime = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case '6h':
                    startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                    break;
                case '24h':
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
            }
            
            query = query.gte('created_at', startTime.toISOString());
        }
        
        query = query.limit(limit);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return data.reverse(); // Return in chronological order
    } catch (error) {
        console.error(`Error fetching ${sensorType} data:`, error);
        return [];
    }
}

// Fetch all sensor data for dashboard
async function fetchAllSensorData() {
    const sensors = ['dht1', 'bmp280', 'hall', 'lt', 'mq135'];
    const allData = {};
    
    for (const sensor of sensors) {
        allData[sensor] = await fetchSensorData(sensor, 50, '1h');
    }
    
    return allData;
}

// Fetch fault history
async function fetchFaultHistory() {
    try {
        const { data, error } = await supabase
            .from('rt_noise_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching fault history:', error);
        return [];
    }
}

// Update relay status (for fault detection)
async function updateRelayStatus(status, sensor = null, reason = null) {
    try {
        const { data, error } = await supabase
            .from('relay_status')
            .upsert({
                status: status,
                sensor: sensor,
                reason: reason,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error updating relay status:', error);
        return null;
    }
}

// Get current relay status
async function getRelayStatus() {
    try {
        const { data, error } = await supabase
            .from('relay_status')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching relay status:', error);
        return null;
    }
}

// Insert new reading
async function insertReading(sensorType, value, unit) {
    try {
        const { data, error } = await supabase
            .from(sensorType + '_readings')
            .insert({
                value: value,
                unit: unit,
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error inserting reading:', error);
        return null;
    }
}

// Subscribe to real-time changes
function subscribeToRealtime(channel, table, event, callback) {
    const subscription = supabase
        .channel(channel)
        .on(
            'postgres_changes',
            {
                event: event,
                schema: 'public',
                table: table
            },
            callback
        )
        .subscribe();
    
    return subscription;
}

// Export functions
window.supabaseClient = {
    supabase,
    testConnection,
    fetchSensorData,
    fetchAllSensorData,
    fetchFaultHistory,
    updateRelayStatus,
    getRelayStatus,
    insertReading,
    subscribeToRealtime
};