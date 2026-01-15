// Global state
let timelineData = null;
let segmentsByDate = {};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const calendarSection = document.getElementById('calendarSection');
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const previewSection = document.getElementById('previewSection');
const downloadBtn = document.getElementById('downloadBtn');

// Initialize event listeners
uploadArea.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
nextMonthBtn.addEventListener('click', () => navigateMonth(1));
downloadBtn.addEventListener('click', downloadSelectedDateData);

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    if (!file.name.endsWith('.json')) {
        alert('Please upload a JSON file');
        return;
    }

    fileName.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.semanticSegments || !Array.isArray(data.semanticSegments)) {
                throw new Error('Invalid Timeline format');
            }
            timelineData = data;
            processTimelineData();
            
            // Show file info and hide upload area
            uploadArea.style.display = 'none';
            fileInfo.style.display = 'flex';
            calendarSection.style.display = 'block';
            
            // Render calendar
            renderCalendar();
        } catch (error) {
            alert('Error parsing JSON file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Process timeline data and split segments by date
function processTimelineData() {
    segmentsByDate = {};
    
    timelineData.semanticSegments.forEach(segment => {
        const splitSegments = splitSegmentByDays(segment);
        splitSegments.forEach(splitSeg => {
            const dateKey = splitSeg.dateKey;
            if (!segmentsByDate[dateKey]) {
                segmentsByDate[dateKey] = [];
            }
            segmentsByDate[dateKey].push(splitSeg.segment);
        });
    });
}

// Split a segment that spans multiple days at midnight boundaries
function splitSegmentByDays(segment) {
    const startTime = new Date(segment.startTime);
    const endTime = new Date(segment.endTime);
    
    // Get date strings (YYYY-MM-DD)
    const startDate = getDateString(startTime);
    const endDate = getDateString(endTime);
    
    // If same day, no splitting needed
    if (startDate === endDate) {
        return [{
            dateKey: startDate,
            segment: segment
        }];
    }
    
    // Split across multiple days
    const result = [];
    let currentDate = new Date(startTime);
    currentDate.setHours(0, 0, 0, 0);
    
    while (getDateString(currentDate) <= endDate) {
        const dateKey = getDateString(currentDate);
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setDate(dayEnd.getDate() + 1);
        dayEnd.setMilliseconds(-1);
        
        // Determine actual segment boundaries for this day
        const segStart = currentDate.getTime() < startTime.getTime() ? startTime : dayStart;
        const segEnd = dayEnd.getTime() > endTime.getTime() ? endTime : dayEnd;
        
        // Create segment copy for this day
        const daySeg = JSON.parse(JSON.stringify(segment));
        daySeg.startTime = segStart.toISOString();
        daySeg.endTime = segEnd.toISOString();
        
        // Filter timelinePath points for this day
        if (daySeg.timelinePath) {
            daySeg.timelinePath = daySeg.timelinePath.filter(point => {
                const pointTime = new Date(point.time);
                return pointTime >= segStart && pointTime <= segEnd;
            });
        }
        
        result.push({
            dateKey: dateKey,
            segment: daySeg
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
}

// Get date string in YYYY-MM-DD format
function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Calendar rendering
function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    calendarTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        // Check if this date has data
        if (segmentsByDate[dateKey]) {
            dayCell.classList.add('has-data');
            dayCell.addEventListener('click', () => selectDate(dateKey));
        }
        
        // Check if this is the selected date
        if (selectedDate === dateKey) {
            dayCell.classList.add('selected');
        }
        
        calendarGrid.appendChild(dayCell);
    }
}

// Navigate between months
function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

// Select a date and show preview
function selectDate(dateKey) {
    selectedDate = dateKey;
    renderCalendar(); // Re-render to show selection
    
    const segments = segmentsByDate[dateKey];
    const stats = calculateStats(segments);
    
    // Update preview section
    document.getElementById('selectedDate').textContent = formatDateDisplay(dateKey);
    document.getElementById('statSegments').textContent = stats.totalSegments;
    document.getElementById('statVisits').textContent = stats.visits;
    document.getElementById('statActivities').textContent = stats.activities;
    document.getElementById('statDistance').textContent = stats.distance;
    document.getElementById('statTimeRange').textContent = stats.timeRange;
    document.getElementById('statActivityTypes').textContent = stats.activityTypes;
    
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Calculate statistics for selected date
function calculateStats(segments) {
    let visits = 0;
    let activities = 0;
    let totalDistance = 0;
    let minTime = null;
    let maxTime = null;
    const activityTypeSet = new Set();
    
    segments.forEach(segment => {
        // Count visits
        if (segment.visit) {
            visits++;
        }
        
        // Count activities and sum distance
        if (segment.activity) {
            activities++;
            if (segment.activity.distanceMeters) {
                totalDistance += segment.activity.distanceMeters;
            }
            if (segment.activity.topCandidate && segment.activity.topCandidate.type) {
                activityTypeSet.add(segment.activity.topCandidate.type);
            }
        }
        
        // Track time range
        const start = new Date(segment.startTime);
        const end = new Date(segment.endTime);
        if (!minTime || start < minTime) minTime = start;
        if (!maxTime || end > maxTime) maxTime = end;
    });
    
    // Format distance
    let distanceStr = '-';
    if (totalDistance > 0) {
        if (totalDistance >= 1000) {
            distanceStr = (totalDistance / 1000).toFixed(2) + ' km';
        } else {
            distanceStr = totalDistance.toFixed(0) + ' m';
        }
    }
    
    // Format time range
    let timeRange = '-';
    if (minTime && maxTime) {
        const startStr = minTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const endStr = maxTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        timeRange = `${startStr} - ${endStr}`;
    }
    
    // Format activity types
    let activityTypes = '-';
    if (activityTypeSet.size > 0) {
        const types = Array.from(activityTypeSet).map(type => {
            return type.replace(/_/g, ' ').toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        });
        activityTypes = types.join(', ');
    }
    
    return {
        totalSegments: segments.length,
        visits,
        activities,
        distance: distanceStr,
        timeRange,
        activityTypes
    };
}

// Format date for display
function formatDateDisplay(dateKey) {
    const [year, month, day] = dateKey.split('-');
    const date = new Date(year, parseInt(month) - 1, day);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Download data for selected date
function downloadSelectedDateData() {
    if (!selectedDate || !segmentsByDate[selectedDate]) {
        alert('Please select a date first');
        return;
    }
    
    const dateData = {
        semanticSegments: segmentsByDate[selectedDate]
    };
    
    const jsonStr = JSON.stringify(dateData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Timeline_${selectedDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
