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
  const availableMetrics = ["Area", "Latency", "Power", "Performance"];

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
        
        const labData = XLSX.utils.sheet_to_json(labSheet);
        
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
        
        console.log("All detected properties:", Array.from(allProperties));
        
        // Filter to only include our metrics of interest
        const availableColumns = availableMetrics.filter(metric => 
          Array.from(allProperties).includes(metric)
        );
        
        console.log("Available metrics:", availableColumns);
        
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

    processSelectedData();
  }, [selectedWorksheet, targetStudentId, selectedMetric, includeFirstDemo, includeSecondDemo, workbook, excelFileLoaded]);
  
  // Separate data processing function to call when filters change
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
        // Instead of setting error state, set the error message
        setErrorMessage("At least one demo type must be selected");
        setStudentData(null); // Clear data but keep UI
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
      // Can be customized if needed
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
        
        // Format the range display differently based on the magnitude of values
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
        allStudents: allStudentsFormatted
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
      {targetStudentId && (
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
      
      {/* Show visualization panels only if we have data */}
      <div className={`visualization-content ${!studentData ? 'disabled-content' : ''}`}>
        {!studentData ? (
          <div className="no-data-overlay">
            <div className="no-data-message">
              {targetStudentId ? "Select at least one demo type to view visualizations" : "Enter a student ID to view analysis"}
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
                <div className="stat-value">{studentData.student[`${selectedWorksheet} Score`]}</div>
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