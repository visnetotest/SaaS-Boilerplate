'use client';

import React, { useState, useCallback } from 'react';
import { WorkflowStep } from '@/features/workflow-automation/types';

// Validation types
interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'required' | 'condition' | 'logic' | 'performance';
  config: Record<string, unknown>;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100
  executionTime: number; // in ms
}

interface ValidationError {
  stepId: string;
  ruleId: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
  data?: unknown;
}

interface ValidationWarning {
  stepId: string;
  ruleId: string;
  message: string;
  field?: string;
  suggestion?: string;
}

// Built-in validation rules
const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'required-fields',
    name: 'Required Fields',
    description: 'All required fields must be filled',
    type: 'required',
    config: {},
    enabled: true,
    severity: 'error'
  },
  {
    id: 'step-connections',
    name: 'Step Connections',
    description: 'Every step must have at least one incoming or outgoing connection',
    type: 'logic',
    config: { allowStart: false, allowEnd: false },
    enabled: true,
    severity: 'error'
  },
  {
    id: 'no-orphan-steps',
    name: 'No Orphan Steps',
    description: 'All steps must be reachable from the start step',
    type: 'logic',
    config: {},
    enabled: true,
    severity: 'error'
  },
  {
    id: 'conditional-logic',
    name: 'Conditional Logic',
    description: 'Decision branches must have valid conditions',
    type: 'condition',
    config: {},
    enabled: true,
    severity: 'error'
  },
  {
    id: 'loop-limits',
    name: 'Loop Limits',
    description: 'Loops must have reasonable iteration limits',
    type: 'performance',
    config: { maxIterations: 100, timeoutMinutes: 60 },
    enabled: true,
    severity: 'warning'
  },
  {
    id: 'timeout-validation',
    name: 'Timeout Validation',
    description: 'All steps must have reasonable timeout values',
    type: 'performance',
    config: { maxTimeout: 3600, minTimeout: 5 },
    enabled: true,
    severity: 'warning'
  },
  {
    id: 'integration-testing',
    name: 'Integration Testing',
    description: 'Integration steps must pass connectivity tests',
    type: 'logic',
    config: { mockMode: true },
    enabled: false,
    severity: 'info'
  }
];

/**
 * Workflow Validator Service
 */
class WorkflowValidator {
  /**
   * Validate entire workflow
   */
  validateWorkflow(steps: WorkflowStep[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 100;

    const startTime = Date.now();

    // Check each rule
    for (const rule of VALIDATION_RULES) {
      if (!rule.enabled) continue;

      const ruleErrors = this.validateRule(rule, steps);
      errors.push(...ruleErrors);

      // Adjust score based on severity
      for (const error of ruleErrors) {
        if (error.severity === 'error') score -= 20;
        else if (error.severity === 'warning') score -= 10;
      }
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
      executionTime
    };
  }

  /**
   * Validate single rule
   */
  private validateRule(rule: ValidationRule, steps: WorkflowStep[]): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (rule.type) {
      case 'required':
        for (const step of steps) {
          if (rule.config.fields) {
            for (const field of rule.config.fields as any[]) {
              const value = this.getFieldValue(step, field.name);
              if (field.required && (value === undefined || value === null || value === '')) {
                errors.push({
                  stepId: step.id,
                  ruleId: rule.id,
                  message: `Required field '${field.name}' is missing`,
                  field: field.name,
                  severity: 'error',
                  data: { field, value }
                });
              }
            }
          }
        }
        break;

      case 'logic':
        if (rule.id === 'step-connections') {
          const connectedSteps = new Set<string>();
          steps.forEach(step => {
            if (step.nextSteps) {
              step.nextSteps.forEach(nextId => connectedSteps.add(nextId));
            }
          });

          // Check for disconnected steps
          const startSteps = steps.filter(step => 
            !step.nextSteps || step.nextSteps.length === 0
          );

          for (const startStep of startSteps) {
            if (!connectedSteps.has(startStep.id)) {
              errors.push({
                stepId: startStep.id,
                ruleId: rule.id,
                message: 'Step is not connected to the workflow',
                field: 'connections',
                severity: 'error',
                data: { stepId: startStep.id, connections: startStep.nextSteps || [] }
              });
            }
          }
        }
        break;

      case 'condition':
        if (rule.id === 'conditional-logic') {
          for (const step of steps) {
            if (step.type === 'decision' && step.conditions) {
              const hasValidConditions = step.conditions.some(condition => 
                this.validateCondition(condition)
              );
              
              if (!hasValidConditions) {
                errors.push({
                  stepId: step.id,
                  ruleId: rule.id,
                  message: 'Decision step has invalid conditions',
                  field: 'conditions',
                  severity: 'error',
                  data: { stepId: step.id, conditions: step.conditions }
                });
              }
            }
          }
        }
        break;

      case 'performance':
        if (rule.id === 'timeout-validation') {
          for (const step of steps) {
            const timeout = step.timeout || 300;
            
            if (timeout > rule.config.maxTimeout || timeout < rule.config.minTimeout) {
              errors.push({
                stepId: step.id,
                ruleId: rule.id,
                message: `Invalid timeout: ${timeout} seconds (must be ${rule.config.minTimeout}-${rule.config.maxTimeout})`,
                field: 'timeout',
                severity: 'warning',
                data: { stepId: step.id, timeout }
              });
            }
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Validate single condition
   */
  private validateCondition(condition: any): boolean {
    if (!condition.field || !condition.operator || condition.value === undefined) {
      return false;
    }

    // This would be expanded with actual validation logic
    return true; // Simplified for demo
  }

  /**
   * Get field value from step
   */
  private getFieldValue(step: WorkflowStep, fieldName: string): unknown {
    if (step.config && step.config.fields) {
      const fields = step.config.fields as any[];
      const field = fields.find(f => f.name === fieldName);
      return field?.value;
    }
    
    return undefined;
  }
}

/**
 * Workflow Testing Service
 */
class WorkflowTester {
  /**
   * Test workflow execution
   */
  async testWorkflow(steps: WorkflowStep[]): Promise<{
    success: boolean;
    results: TestResult[];
    errors: string[];
    warnings: string[];
    executionTime: number;
  }> {
    const results: TestResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    const startTime = Date.now();

    try {
      // Mock execution simulation
      for (const step of steps) {
        const result = await this.simulateStep(step);
        results.push(result);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: errors.length === 0,
        results,
        errors,
        warnings,
        executionTime
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        errors: [error.message],
        warnings: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Simulate step execution
   */
  private async simulateStep(step: WorkflowStep): Promise<TestResult> {
    // Simulate different step types
    switch (step.type) {
      case 'data-entry':
        return await this.simulateDataEntry(step);
      case 'integration':
        return await this.simulateIntegration(step);
      case 'approval':
        return await this.simulateApproval(step);
      case 'notification':
        return await this.simulateNotification(step);
      default:
        return {
          stepId: step.id,
          stepName: step.name,
          stepType: step.type,
          success: true,
          message: 'Step simulated successfully',
          data: {},
          executionTime: Math.random() * 1000
        };
    }
  }

  private async simulateDataEntry(step: WorkflowStep): Promise<TestResult> {
    // Simulate data collection
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      success: true,
      message: 'Data entry simulated successfully',
      data: { simulated: true },
      executionTime: Math.random() * 2000
    };
  }

  private async simulateIntegration(step: WorkflowStep): Promise<TestResult> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500));
    
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      success: true,
      message: 'Integration simulated successfully',
      data: { 
        connected: true, 
        responseTime: Math.random() * 1000,
        status: 200 
      },
      executionTime: Math.random() * 2000
    };
  }

  private async simulateApproval(step: WorkflowStep): Promise<TestResult> {
    // Simulate approval process
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
    
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      success: true,
      message: 'Approval simulated successfully',
      data: { 
        approved: true, 
        approver: 'system',
        approvalTime: new Date() 
      },
      executionTime: Math.random() * 3000
    };
  }

  private async simulateNotification(step: WorkflowStep): Promise<TestResult> {
    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      success: true,
      message: 'Notification simulated successfully',
      data: { 
        delivered: true, 
        recipients: ['user@example.com'],
        deliveryTime: new Date() 
      },
      executionTime: Math.random() * 500
    };
  }
}

interface TestResult {
  stepId: string;
  stepName: string;
  stepType: string;
  success: boolean;
  message: string;
  data: Record<string, unknown>;
  executionTime: number;
}

/**
 * Workflow Validation and Testing Panel Component
 */
export default function WorkflowValidationPanel({ workflowId }: { workflowId?: string }) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult[]>([]);

  const validator = new WorkflowValidator();
  const tester = new WorkflowTester();

  // Handle workflow validation
  const handleValidate = useCallback(async () => {
    setIsRunning(true);
    setValidationResult(null);
    
    // Mock workflow steps for validation
    const mockSteps: WorkflowStep[] = [
      {
        id: 'step-1',
        type: 'data-entry',
        name: 'User Info',
        config: {
          fields: [
            { name: 'name', type: 'text', required: true, label: 'Full Name' },
            { name: 'email', type: 'email', required: true, label: 'Email Address' }
          ]
        }
      },
      {
        id: 'step-2',
        type: 'decision',
        name: 'Check User Type',
        config: {
          conditions: [
            { field: 'email', operator: 'contains', value: 'company.com' }
          ]
        }
      }
    ];

    // Simulate validation with delay
    setTimeout(() => {
      const result = validator.validateWorkflow(mockSteps);
      setValidationResult(result);
      setIsRunning(false);
    }, 1500);
  }, [validator, isRunning]);

  // Handle workflow testing
  const handleTest = useCallback(async () => {
    setIsRunning(true);
    setTestResult([]);
    
    // Mock workflow steps for testing
    const mockTestSteps: WorkflowStep[] = [
      {
        id: 'test-1',
        type: 'integration',
        name: 'Send Welcome Email',
        config: {
          service: 'email',
          template: 'welcome',
          recipient: '{{user.email}}'
        }
      },
      {
        id: 'test-2',
        type: 'notification',
        name: 'Send SMS Alert',
        config: {
          message: 'Your workflow is ready!',
          recipients: ['+1234567890']
        }
      }
    ];

    // Simulate testing with delay
    const startTime = Date.now();
    
    const results = [];
    for (const step of mockTestSteps) {
      const result = await tester.simulateStep(step);
      results.push(result);
      
      // Add delay between steps
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
    }

    setTestResult(results);
    setIsRunning(false);
  }, [isRunning]);

  return (
    <div className="h-full bg-white border-l border-gray-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              🔍 Workflow Validation & Testing
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Validate workflow logic and test execution</span>
              <span className={`px-2 py-1 rounded-full ${
                isRunning ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {isRunning ? 'Running' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Validation Results</h3>
            <div className={`mb-4 p-3 rounded-lg ${
              validationResult.isValid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-medium ${
                  validationResult.isValid ? 'text-green-700' : 'text-red-700'
                }`}>
                  {validationResult.isValid ? '✅ Valid' : '❌ Invalid'}
                </span>
                <span className="text-sm text-gray-600">
                  Score: {validationResult.score}/100
                </span>
              </div>

              <div className={`flex items-center space-x-2 text-sm ${
                validationResult.isValid ? 'text-green-600' : 'text-red-600'
                }`}>
                  Time: {validationResult.executionTime}ms
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-medium text-red-700 mb-2">Errors Found</h4>
                  {validationResult.errors.map((error, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded border border-red-200">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                          !
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-red-700">
                          {error.ruleId}: {error.message}
                        </div>
                        {error.field && (
                          <div className="text-xs text-red-600 mt-1">
                            Field: {error.field}
                          </div>
                        )}
                        {error.stepId && (
                          <div className="text-xs text-red-600 mt-1">
                            Step ID: {error.stepId}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-medium text-yellow-700 mb-2">Warnings</h4>
                  {validationResult.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full text-white text-xs flex items-center justify-center">
                          !
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-yellow-700">
                          {warning.ruleId}: {warning.message}
                        </div>
                        {warning.stepId && (
                          <div className="text-xs text-yellow-600 mt-1">
                            Step ID: {warning.stepId}
                          </div>
                        )}
                        {warning.field && (
                          <div className="text-xs text-yellow-600 mt-1">
                            Field: {warning.field}
                          </div>
                        )}
                        {warning.suggestion && (
                          <div className="text-xs text-gray-600 mt-1">
                            Suggestion: {warning.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResult.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Results</h3>
            <div className="space-y-2">
              {testResult.map((result, index) => (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${
                  result.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full text-xs flex items-center justify-center ${
                        result.success 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {result.success ? '✓' : '✗'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{result.stepName}</div>
                        <div className={`text-xs ${
                          result.success 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {result.success ? 'Success' : 'Failed'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{result.message}</div>
                        {result.executionTime && (
                          <div className="text-xs text-gray-500">
                            Time: {result.executionTime}ms
                          </div>
                        )}
                        {result.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">Data Details</summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded border border-gray-300 mt-1">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 space-x-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
            onClick={handleValidate}
            disabled={isRunning}
          >
            🔍 Validate Workflow
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
            onClick={handleTest}
            disabled={isRunning || !validationResult?.isValid}
          >
            ⚡ Test Workflow
          </button>
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
            onClick={() => {
              setValidationResult(null);
              setTestResult([]);
            }}
          >
            🗑️ Clear Results
          </button>
        </div>
      </div>
    </div>
  );
}