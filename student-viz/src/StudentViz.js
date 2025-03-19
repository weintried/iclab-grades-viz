import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell, ReferenceLine, ZAxis } from 'recharts';
import * as XLSX from 'xlsx';
import './StudentViz.css'

const StudentPositionVisualization = () => {
  // Replace hardcoded configuration with state variables
  const [availableWorksheets, setAvailableWorksheets] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState("");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [excelFileLoaded, setExcelFileLoaded] = useState(false);
  
  // Available metrics for visualization
  const availableMetrics = ["Area", "Latency", "Power", "Performance", "CT"];

  // Format value based on magnitude - moved to component scope
  const formatValue = (value) => {
    return value > 1000 ? (value/1000).toFixed(2) + 'k' : value.toFixed(2);
  };

  const [studentData, setStudentData] = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const targetRowRef = useRef(null);
  
  // New state variables for filters and metric selection
  const [includeFirstDemo, setIncludeFirstDemo] = useState(true);
  const [includeSecondDemo, setIncludeSecondDemo] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState("Area");
  const [availableColumnsInSheet, setAvailableColumnsInSheet] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  
  // New state variables for Lab03 specific filters
  const [isLab03, setIsLab03] = useState(false);
  const [designFilter, setDesignFilter] = useState({first: true, second: true});
  const [patternFilter, setPatternFilter] = useState({first: true, second: true});

  const scrollToTargetRow = () => {
    if (targetRowRef.current) {
      targetRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle metric change
  const handleMetricChange = (metric) => {
    if (availableColumnsInSheet.includes(metric)) {
      setSelectedMetric(metric);
    } else {
      setError(`Column "${metric}" not available in the current sheet`);
    }
  };

  // Initial load of Excel file to get available worksheets
  useEffect(() => {
    const loadExcelFile = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        
        const response = await fetch('/Student.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), {
          cellStyles: true,
          cellFormulas: true,
          cellDates: true,
          cellNF: true,
          sheetStubs: true
        });
        
        setWorkbook(wb);
        
        // Find worksheets matching the "Lab" pattern (Lab01, Lab02, etc.)
        const labWorksheets = wb.SheetNames.filter(name => /^Lab\d+$/i.test(name)).sort();
        
        if (labWorksheets.length === 0) {
          setErrorMessage("No Lab worksheets found in the Excel file");
        } else {
          setAvailableWorksheets(labWorksheets);
          setSelectedWorksheet(labWorksheets[0]); // Select first worksheet by default
          setExcelFileLoaded(true);
        }
        
        setLoading(false);
      } catch (err) {
        setErrorMessage("Error loading Excel file: " + err.message);
        setLoading(false);
      }
    };

    loadExcelFile();
  }, []);
  
  // Effect to detect if Lab03 is selected
  useEffect(() => {
    setIsLab03(selectedWorksheet === "Lab03");
  }, [selectedWorksheet]);

  // Function to handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const formattedStudentId = `iclab${studentIdInput.padStart(3, '0')}`;
    setTargetStudentId(formattedStudentId);
  };

  // Process data when worksheet or student ID changes
  useEffect(() => {
    if (!excelFileLoaded || !selectedWorksheet || !targetStudentId) {
      return; // Wait until we have all necessary inputs
    }
    
    const processSelectedData = () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        
        if (!workbook) {
          setErrorMessage("Excel file not loaded");
          setLoading(false);
          return;
        }
        
        const labSheet = workbook.Sheets[selectedWorksheet];
        if (!labSheet) {
          setErrorMessage(`Worksheet ${selectedWorksheet} not found`);
          setLoading(false);
          return;
        }
        
        // Special handling for Lab03 with nested structure
        if (selectedWorksheet === "Lab03") {
          processLab03Data(labSheet);
        } else {
          // Normal processing for other labs
          const labData = XLSX.utils.sheet_to_json(labSheet);
          processRegularLabData(labData);
        }
      } catch (err) {
        setErrorMessage("Error analyzing student data: " + err.message);
        setLoading(false);
      }
    };

    processSelectedData();
  }, [selectedWorksheet, targetStudentId, selectedMetric, includeFirstDemo, includeSecondDemo, workbook, excelFileLoaded, designFilter, patternFilter, isLab03]);
  
  // Special function to handle Lab03 data
  const processLab03Data = (labSheet) => {
    try {
      // Convert to raw data to handle nested structure manually
      const rawData = XLSX.utils.sheet_to_json(labSheet, { header: 1 });
      
      // Find header row indexes
      let headers = rawData[0]; // First row typically contains header names
      let performanceIndex = -1;
      
      // Find "Performance Results" column index
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] === "Performance Results") {
          performanceIndex = i;
          break;
        }
      }
      
      if (performanceIndex === -1) {
        throw new Error("Could not find 'Performance Results' header in Lab03");
      }
      
      // Determine column indexes for required data
      const accountIndex = headers.indexOf("Account");
      
      // Find index of Design Pass and Pattern Pass in the subheader row
      const subHeaders = rawData[1] || []; // Second row contains subheaders
      
      const designPassIndex = subHeaders.findIndex((h) => h === "Design Pass");
      const patternPassIndex = subHeaders.findIndex((h) => h === "Pattern Pass");
      
      // Find performance metric indexes from subheaders
      const ctIndex = subHeaders.findIndex((h) => h === "CT");
      const latencyIndex = subHeaders.findIndex((h) => h === "Latency");
      const areaIndex = subHeaders.findIndex((h) => h === "Area");
      const perfIndex = subHeaders.findIndex((h) => h === "Performance");
      
      // Collect available metrics
      const availableColumns = [];
      if (ctIndex !== -1) availableColumns.push("CT");
      if (latencyIndex !== -1) availableColumns.push("Latency");
      if (areaIndex !== -1) availableColumns.push("Area");
      if (perfIndex !== -1) availableColumns.push("Performance");
      
      setAvailableColumnsInSheet(availableColumns);
      
      // If selected metric isn't available, select first available
      if (!availableColumns.includes(selectedMetric) && availableColumns.length > 0) {
        setSelectedMetric(availableColumns[0]);
      }
      
      // Process data rows (start from row 2, index 2)
      const processedData = [];
      
      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row[accountIndex]) continue; // Skip rows with no account
        
        const studentRecord = {
          Account: row[accountIndex],
          "Design Pass": designPassIndex !== -1 ? row[designPassIndex] : null,
          "Pattern Pass": patternPassIndex !== -1 ? row[patternPassIndex] : null
        };
        
        // Add performance metrics
        if (ctIndex !== -1) studentRecord.CT = parseFloat(row[ctIndex]) || 0;
        if (latencyIndex !== -1) studentRecord.Latency = parseFloat(row[latencyIndex]) || 0;
        if (areaIndex !== -1) studentRecord.Area = parseFloat(row[areaIndex]) || 0;
        if (perfIndex !== -1) studentRecord.Performance = parseFloat(row[perfIndex]) || 0;
        
        processedData.push(studentRecord);
      }
      
      // Find target student
      const targetStudent = processedData.find(row => row.Account === targetStudentId);
      
      if (!targetStudent) {
        setErrorMessage(`Student ${targetStudentId} not found in ${selectedWorksheet}`);
        setLoading(false);
        return;
      }
      
      // Process the data based on Lab03 specific filters
      processLab03FilteredData(processedData, targetStudent, selectedMetric);
      
    } catch (err) {
      setErrorMessage("Error processing Lab03 data: " + err.message);
      setLoading(false);
    }
  };
  
  // Function to filter and process Lab03 data
  const processLab03FilteredData = (labData, targetStudent, metric) => {
    try {
      // Ensure metric exists in the data
      if (!targetStudent.hasOwnProperty(metric)) {
        setErrorMessage(`Metric "${metric}" not found in the data`);
        setLoading(false);
        return;
      }
      
      // Apply Design and Pattern pass filters
      let filteredStudents = labData.filter(student => {
        // Check Design Pass filter
        const designMatch = (designFilter.first && student["Design Pass"] === "1st_demo") || 
                          (designFilter.second && student["Design Pass"] === "2nd_demo");
        
        // Check Pattern Pass filter
        const patternMatch = (patternFilter.first && student["Pattern Pass"] === "1st_demo") || 
                           (patternFilter.second && student["Pattern Pass"] === "2nd_demo");
        
        // Both design and pattern conditions must be met
        return designMatch && patternMatch && 
               typeof student[metric] === 'number' && 
               !isNaN(student[metric]);
      });
      
      if (filteredStudents.length === 0) {
        setErrorMessage("No students match the selected filters");
        setStudentData(null);
        setLoading(false);
        return;
      }
      
      // Clear any previous errors
      setErrorMessage(null);
      
      // For metrics where lower values are better (assumed for all metrics)
      const isLowerBetter = true;
      
      // Sort students by the selected metric
      const sortedStudents = [...filteredStudents].sort((a, b) => 
        isLowerBetter ? a[metric] - b[metric] : b[metric] - a[metric]
      );
      
      // Find student's rank
      const studentRank = sortedStudents.findIndex(s => s.Account === targetStudentId) + 1;
      
      // Calculate percentile rank
      const percentileRank = (studentRank / sortedStudents.length * 100).toFixed(2);
      
      // Find nearby students
      const studentIndex = sortedStudents.findIndex(s => s.Account === targetStudentId);
      const start = Math.max(0, studentIndex - 2);
      const end = Math.min(sortedStudents.length, studentIndex + 3);
      const nearbyStudents = sortedStudents.slice(start, end);
      
      // Format data for visualization
      const allStudentsFormatted = sortedStudents.map((s, index) => ({
        account: s.Account,
        [metric.toLowerCase()]: s[metric],
        designPass: s["Design Pass"],
        patternPass: s["Pattern Pass"],
        isTarget: s.Account === targetStudentId,
        rank: index + 1
      }));
      
      // Create bins for histogram
      const metricValues = sortedStudents.map(s => s[metric]);
      const min = Math.min(...metricValues);
      const max = Math.max(...metricValues);
      
      // Create bins
      const binCount = 10;
      const binWidth = (max - min) / binCount;
      const bins = Array(binCount).fill(0).map((_, i) => {
        const binMin = min + i * binWidth;
        const binMax = min + (i+1) * binWidth;
        
        let rangeFormat;
        if (max > 1000) {
          rangeFormat = `${(binMin/1000).toFixed(1)}k-${(binMax/1000).toFixed(1)}k`;
        } else {
          rangeFormat = `${binMin.toFixed(1)}-${binMax.toFixed(1)}`;
        }
        
        return {
          range: rangeFormat,
          count: 0,
          min: binMin,
          max: binMax,
          containsTarget: targetStudent[metric] >= binMin && targetStudent[metric] < binMax
        };
      });
      
      // Count values in each bin
      for (const student of sortedStudents) {
        for (let i = 0; i < bins.length; i++) {
          if (student[metric] >= bins[i].min && student[metric] < bins[i].max) {
            bins[i].count++;
            break;
          }
        }
      }
      
      setDistribution(bins);
      setStudentData({
        student: targetStudent,
        metric: metric,
        rank: studentRank,
        totalStudents: sortedStudents.length,
        percentileRank,
        nearbyStudents,
        allStudents: allStudentsFormatted,
        isLab03: true
      });
      
      setLoading(false);
    } catch (err) {
      setErrorMessage("Error processing Lab03 data: " + err.message);
      setLoading(false);
    }
  };
  
  // Regular processing for non-Lab03 data
  const processRegularLabData = (labData) => {
    try {
      // Find the target student
      const targetStudent = labData.find(row => row.Account === targetStudentId);
      
      if (!targetStudent) {
        setErrorMessage(`Student ${targetStudentId} not found in ${selectedWorksheet}`);
        setLoading(false);
        return;
      }
      
      // More robust column detection - check which metrics exist in the data
      const sampleSize = Math.min(labData.length, 10);
      const sampleStudents = labData.slice(0, sampleSize);
      
      // Collect all unique property names from the sample students
      const allProperties = new Set();
      sampleStudents.forEach(student => {
        Object.keys(student).forEach(key => allProperties.add(key));
      });
      
      // Filter to only include our metrics of interest
      const availableColumns = availableMetrics.filter(metric => 
        Array.from(allProperties).includes(metric)
      );
      
      setAvailableColumnsInSheet(availableColumns);
      
      // If current selectedMetric is not available, select the first available metric
      if (!availableColumns.includes(selectedMetric) && availableColumns.length > 0) {
        setSelectedMetric(availableColumns[0]);
      }
      
      // Process the data based on filters and selected metric
      processData(labData, targetStudent, selectedMetric, includeFirstDemo, includeSecondDemo);
    } catch (err) {
      setErrorMessage("Error analyzing student data: " + err.message);
      setLoading(false);
    }
  };
  
  // Regular data processing function for non-Lab03
  const processData = (labData, targetStudent, metric, includeFirst, includeSecond) => {
    try {
      // Ensure metric exists in the data
      if (!targetStudent.hasOwnProperty(metric)) {
        setErrorMessage(`Metric "${metric}" not found in the data`);
        setLoading(false);
        return;
      }
      
      // Get students based on filter settings
      const passCriteria = [];
      if (includeFirst) passCriteria.push("1st_demo");
      if (includeSecond) passCriteria.push("2nd_demo");
      
      if (passCriteria.length === 0) {
        setErrorMessage("At least one demo type must be selected");
        setStudentData(null);
        setLoading(false);
        return;
      }
      
      // Clear any previous errors
      setErrorMessage(null);
      
      const filteredStudents = labData.filter(row => 
        passCriteria.includes(row.Pass) && 
        typeof row[metric] === 'number' && 
        !isNaN(row[metric])
      );
      
      // For metrics where lower values are better (assumed for all metrics)
      const isLowerBetter = true;
      
      // Sort students by the selected metric
      const sortedStudents = [...filteredStudents].sort((a, b) => 
        isLowerBetter ? a[metric] - b[metric] : b[metric] - a[metric]
      );
      
      // Find student's rank based on selected metric
      const studentRank = sortedStudents.findIndex(s => s.Account === targetStudentId) + 1;
      
      // Calculate percentile rank
      const percentileRank = (studentRank / sortedStudents.length * 100).toFixed(2);
      
      // Find nearby students for detailed comparison
      const studentIndex = sortedStudents.findIndex(s => s.Account === targetStudentId);
      const start = Math.max(0, studentIndex - 2);
      const end = Math.min(sortedStudents.length, studentIndex + 3);
      const nearbyStudents = sortedStudents.slice(start, end);
      
      // Format data for visualization
      const allStudentsFormatted = sortedStudents.map((s, index) => ({
        account: s.Account,
        [metric.toLowerCase()]: s[metric],
        pass: s.Pass,
        isTarget: s.Account === targetStudentId,
        rank: index + 1
      }));
      
      // Create bins for histogram
      const metricValues = sortedStudents.map(s => s[metric]);
      const min = Math.min(...metricValues);
      const max = Math.max(...metricValues);
      
      // Create custom bin ranges
      const binCount = 10;
      const binWidth = (max - min) / binCount;
      const bins = Array(binCount).fill(0).map((_, i) => {
        const binMin = min + i * binWidth;
        const binMax = min + (i+1) * binWidth;
        
        let rangeFormat;
        if (max > 1000) {
          rangeFormat = `${(binMin/1000).toFixed(1)}k-${(binMax/1000).toFixed(1)}k`;
        } else {
          rangeFormat = `${binMin.toFixed(1)}-${binMax.toFixed(1)}`;
        }
        
        return {
          range: rangeFormat,
          count: 0,
          min: binMin,
          max: binMax,
          containsTarget: targetStudent[metric] >= binMin && targetStudent[metric] < binMax
        };
      });
      
      // Count values in each bin
      for (const student of sortedStudents) {
        for (let i = 0; i < bins.length; i++) {
          if (student[metric] >= bins[i].min && student[metric] < bins[i].max) {
            bins[i].count++;
            break;
          }
        }
      }
      
      setDistribution(bins);
      setStudentData({
        student: targetStudent,
        metric: metric,
        rank: studentRank,
        totalStudents: sortedStudents.length,
        percentileRank,
        nearbyStudents: nearbyStudents.map((s, i) => ({
          ...s,
          rankByMetric: start + i + 1
        })),
        allStudents: allStudentsFormatted,
        isLab03: false
      });
      setLoading(false);
    } catch (err) {
      setErrorMessage("Error processing data: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <h2 className="text-xl font-bold mb-4 text-center">Student Performance Analysis</h2>
      
      {/* Selection Form for Lab and Student ID */}
      <form onSubmit={handleSubmit} className="selection-form">
        <div className="form-group">
          <label htmlFor="worksheet-select">Select Lab:</label>
          <select 
            id="worksheet-select"
            value={selectedWorksheet}
            onChange={(e) => setSelectedWorksheet(e.target.value)}
            disabled={!excelFileLoaded || loading}
            className="form-select"
          >
            {availableWorksheets.map(sheet => (
              <option key={sheet} value={sheet}>{sheet}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="student-id">Student ID (e.g. 099):</label>
          <div className="id-input-container">
            <span className="id-prefix">iclab</span>
            <input 
              id="student-id"
              type="text" 
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 099"
              className="id-input"
              pattern="\d{1,3}"
              maxLength="3"
              disabled={loading}
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          className="submit-button"
          disabled={!excelFileLoaded || !studentIdInput || loading}
        >
          View Analysis
        </button>
      </form>
      
      {/* Show loading state or current selection */}
      {loading ? (
        <div className="p-4 text-center">Loading your data...</div>
      ) : targetStudentId && (
        <div className="current-selection">
          Viewing: {selectedWorksheet} - Student {targetStudentId}
        </div>
      )}
      
      {/* Error message display */}
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      {/* Only show controls if we have a selected student */}
      {targetStudentId && !isLab03 && (
        <div className="controls-container">
          <h3 className="controls-header">Configure Visualization</h3>
          <div className="controls-flex-container">
            <div className="filter-controls">
              <h3>Include Students:</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={includeFirstDemo} 
                    onChange={() => setIncludeFirstDemo(!includeFirstDemo)}
                  />
                  <span>1st_demo</span>
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={includeSecondDemo} 
                    onChange={() => setIncludeSecondDemo(!includeSecondDemo)} 
                  />
                  <span>2nd_demo</span>
                </label>
              </div>
            </div>
            
            <div className="metric-selector">
              <h3>Select Metric:</h3>
              <div className="radio-group">
                {availableColumnsInSheet.map(metricName => (
                  <label key={metricName} className="radio-label">
                    <input
                      type="radio"
                      className="large-radio"
                      name="metric"
                      value={metricName}
                      checked={selectedMetric === metricName}
                      onChange={() => handleMetricChange(metricName)}
                    />
                    <span>{metricName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Lab03 Specific Controls */}
      {targetStudentId && isLab03 && (
        <div className="controls-container">
          <h3 className="controls-header">Lab03 Configuration</h3>
          <div className="controls-flex-container">
            <div className="filter-controls">
              <h3>Design Pass:</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={designFilter.first} 
                    onChange={() => setDesignFilter({...designFilter, first: !designFilter.first})}
                  />
                  <span>1st_demo</span>
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={designFilter.second} 
                    onChange={() => setDesignFilter({...designFilter, second: !designFilter.second})} 
                  />
                  <span>2nd_demo</span>
                </label>
              </div>
            </div>
            
            <div className="filter-controls">
              <h3>Pattern Pass:</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={patternFilter.first} 
                    onChange={() => setPatternFilter({...patternFilter, first: !patternFilter.first})}
                  />
                  <span>1st_demo</span>
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="large-checkbox"
                    checked={patternFilter.second} 
                    onChange={() => setPatternFilter({...patternFilter, second: !patternFilter.second})} 
                  />
                  <span>2nd_demo</span>
                </label>
              </div>
            </div>
            
            <div className="metric-selector">
              <h3>Select Metric:</h3>
              <div className="radio-group">
                {availableColumnsInSheet.map(metricName => (
                  <label key={metricName} className="radio-label">
                    <input
                      type="radio"
                      className="large-radio"
                      name="metric"
                      value={metricName}
                      checked={selectedMetric === metricName}
                      onChange={() => handleMetricChange(metricName)}
                    />
                    <span>{metricName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Show visualization panels only if we have data */}
      <div className={`visualization-content ${!studentData ? 'disabled-content' : ''}`}>
        {!studentData ? (
          <div className="no-data-overlay">
            <div className="no-data-message">
              {targetStudentId ? 
                (isLab03 ? "Select at least one filter for Design and Pattern" : "Select at least one demo type to view visualizations")
              : "Enter a student ID to view analysis"}
            </div>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Your {studentData.metric}</div>
                <div className="stat-value">{formatValue(studentData.student[studentData.metric])}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Rank (by {studentData.metric})</div>
                <div className="stat-value">{studentData.rank} of {studentData.totalStudents}</div>
                <div className="stat-hint">Lower is better</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Percentile</div>
                <div className="stat-value">{studentData.percentileRank}%</div>
                <div className="stat-hint">Lower is better</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Lab Score</div>
                <div className="stat-value">{studentData.student[`${selectedWorksheet} Score`] || "N/A"}</div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="section-title">Your Position in {studentData.metric} Distribution</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="range" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60} 
                      tickMargin={15}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [value, 'Count']}
                      labelFormatter={(label) => `Range: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Students">
                      {distribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.containsTarget ? '#FF5722' : '#8884d8'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-hint">
                Your bin is highlighted in orange
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="section-title">Ranking of Students by {studentData.metric}</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="rank" 
                      name="Rank" 
                      domain={[1, studentData.totalStudents]}
                      label={{ value: 'Rank (lower is better)', position: 'bottom', offset: 20 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey={studentData.metric.toLowerCase()} 
                      name={studentData.metric} 
                      domain={['dataMin', 'dataMax']}
                      label={{ value: studentData.metric, angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => formatValue(value)}
                    />
                    <ZAxis range={[60, 60]} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === studentData.metric.toLowerCase() ? formatValue(value) : value, 
                        name === studentData.metric.toLowerCase() ? studentData.metric : name
                      ]}
                      labelFormatter={(label) => `Rank: ${label}`}
                    />
                    <ReferenceLine y={studentData.student[studentData.metric]} stroke="#FF5722" strokeDasharray="3 3" />
                    <Scatter name="Students" data={studentData.allStudents}>
                      {studentData.allStudents.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isTarget ? '#FF5722' : entry.pass === '1st_demo' ? '#8884d8' : '#82ca9d'} 
                          r={entry.isTarget ? 8 : 4}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-container">
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#FF5722' }}></span>
                  <span>Your position</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#8884d8' }}></span>
                  <span>1st_demo</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#82ca9d' }}></span>
                  <span>2nd_demo</span>
                </div>
              </div>
            </div>

            <div className="scrollable-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Account</th>
                    <th>Pass</th>
                    <th>{studentData.metric}</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {studentData.allStudents.map((s) => (
                    <tr 
                      key={s.account} 
                      ref={s.account === targetStudentId ? targetRowRef : null} 
                      className={s.account === targetStudentId ? 'highlight-row' : ''}
                    >
                      <td>{s.rank}</td>
                      <td className="font-medium">
                        {s.account} {s.account === targetStudentId ? '(YOU)' : ''}
                      </td>
                      <td>{s.pass}</td>
                      <td>{formatValue(s[studentData.metric.toLowerCase()])}</td>
                      <td>
                        {s.account === targetStudentId ? '-' : 
                          formatValue(s[studentData.metric.toLowerCase()] - studentData.student[studentData.metric])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button 
              className="scroll-button" 
              onClick={scrollToTargetRow}
            >
              Scroll to Your Rank
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentPositionVisualization;