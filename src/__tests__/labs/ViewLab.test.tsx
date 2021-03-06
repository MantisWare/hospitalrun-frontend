import { Badge, Button, Alert } from '@hospitalrun/components'
import { act } from '@testing-library/react'
import format from 'date-fns/format'
import { mount, ReactWrapper } from 'enzyme'
import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import { Router, Route } from 'react-router-dom'
import createMockStore from 'redux-mock-store'
import thunk from 'redux-thunk'

import * as validateUtil from '../../labs/utils/validate-lab'
import { LabError } from '../../labs/utils/validate-lab'
import ViewLab from '../../labs/ViewLab'
import * as ButtonBarProvider from '../../page-header/button-toolbar/ButtonBarProvider'
import * as titleUtil from '../../page-header/title/TitleContext'
import TextFieldWithLabelFormGroup from '../../shared/components/input/TextFieldWithLabelFormGroup'
import LabRepository from '../../shared/db/LabRepository'
import PatientRepository from '../../shared/db/PatientRepository'
import Lab from '../../shared/model/Lab'
import Patient from '../../shared/model/Patient'
import Permissions from '../../shared/model/Permissions'
import { RootState } from '../../shared/store'

const mockStore = createMockStore<RootState, any>([thunk])

describe('View Lab', () => {
  let history: any
  const mockPatient = { fullName: 'test' }
  const mockLab = {
    code: 'L-1234',
    id: '12456',
    status: 'requested',
    patient: '1234',
    type: 'lab type',
    notes: ['lab notes'],
    requestedOn: '2020-03-30T04:43:20.102Z',
  } as Lab

  let setButtonToolBarSpy: any
  let labRepositorySaveSpy: any
  const expectedDate = new Date()

  const setup = async (lab: Lab, permissions: Permissions[], error = {}) => {
    jest.resetAllMocks()
    Date.now = jest.fn(() => expectedDate.valueOf())
    setButtonToolBarSpy = jest.fn()
    jest.spyOn(titleUtil, 'useUpdateTitle').mockImplementation(() => jest.fn())
    jest.spyOn(ButtonBarProvider, 'useButtonToolbarSetter').mockReturnValue(setButtonToolBarSpy)
    labRepositorySaveSpy = jest.spyOn(LabRepository, 'saveOrUpdate').mockResolvedValue(mockLab)
    jest.spyOn(PatientRepository, 'find').mockResolvedValue(mockPatient as Patient)
    jest.spyOn(LabRepository, 'find').mockResolvedValue(lab)

    history = createMemoryHistory()
    history.push(`labs/${lab.id}`)
    const store = mockStore({
      user: {
        permissions,
      },
      lab: {
        lab,
        patient: mockPatient,
        error,
        status: Object.keys(error).length > 0 ? 'error' : 'completed',
      },
    } as any)

    let wrapper: any
    await act(async () => {
      wrapper = await mount(
        <ButtonBarProvider.ButtonBarProvider>
          <Provider store={store}>
            <Router history={history}>
              <Route path="/labs/:id">
                <titleUtil.TitleProvider>
                  <ViewLab />
                </titleUtil.TitleProvider>
              </Route>
            </Router>
          </Provider>
        </ButtonBarProvider.ButtonBarProvider>,
      )
    })
    wrapper.find(ViewLab).props().updateTitle = jest.fn()
    wrapper.update()
    return { wrapper: wrapper as ReactWrapper }
  }

  describe('title', () => {
    it('should have called the useUpdateTitle hook', async () => {
      const expectedLab = { ...mockLab } as Lab
      await setup(expectedLab, [Permissions.ViewLab])
      expect(titleUtil.useUpdateTitle).toHaveBeenCalled()
    })
  })

  describe('page content', () => {
    it('should display the patient full name for the for', async () => {
      const expectedLab = { ...mockLab } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
      const forPatientDiv = wrapper.find('.for-patient')

      expect(forPatientDiv.find('h4').text().trim()).toEqual('labs.lab.for')

      expect(forPatientDiv.find('h5').text().trim()).toEqual(mockPatient.fullName)
    })

    it('should display the lab type for type', async () => {
      const expectedLab = { ...mockLab, type: 'expected type' } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
      const labTypeDiv = wrapper.find('.lab-type')
      expect(labTypeDiv.find('h4').text().trim()).toEqual('labs.lab.type')

      expect(labTypeDiv.find('h5').text().trim()).toEqual(expectedLab.type)
    })

    it('should display the requested on date', async () => {
      const expectedLab = { ...mockLab, requestedOn: '2020-03-30T04:43:20.102Z' } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
      const requestedOnDiv = wrapper.find('.requested-on')
      expect(requestedOnDiv.find('h4').text().trim()).toEqual('labs.lab.requestedOn')

      expect(requestedOnDiv.find('h5').text().trim()).toEqual(
        format(new Date(expectedLab.requestedOn), 'yyyy-MM-dd hh:mm a'),
      )
    })

    it('should not display the completed date if the lab is not completed', async () => {
      const expectedLab = { ...mockLab } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
      const completedOnDiv = wrapper.find('.completed-on')

      expect(completedOnDiv).toHaveLength(0)
    })

    it('should not display the canceled date if the lab is not canceled', async () => {
      const expectedLab = { ...mockLab } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
      const completedOnDiv = wrapper.find('.canceled-on')

      expect(completedOnDiv).toHaveLength(0)
    })

    it('should render a result text field', async () => {
      const expectedLab = {
        ...mockLab,
        result: 'expected results',
      } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

      const resultTextField = wrapper.find(TextFieldWithLabelFormGroup).at(0)

      expect(resultTextField).toBeDefined()
      expect(resultTextField.prop('label')).toEqual('labs.lab.result')
      expect(resultTextField.prop('value')).toEqual(expectedLab.result)
    })

    it('should display the past notes', async () => {
      const expectedNotes = 'expected notes'
      const expectedLab = { ...mockLab, notes: [expectedNotes] } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

      const notes = wrapper.findWhere((w) => w.prop('data-test') === 'note')
      const pastNotesIndex = notes.reduce(
        (result: number, item: ReactWrapper, index: number) =>
          item.text().trim() === expectedNotes ? index : result,
        -1,
      )

      expect(pastNotesIndex).not.toBe(-1)
      expect(notes).toHaveLength(1)
    })

    it('should not display past notes if there is not', async () => {
      const expectedLab = { ...mockLab, notes: undefined } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

      const notes = wrapper.findWhere((w) => w.prop('data-test') === 'note')

      expect(notes).toHaveLength(0)
    })

    it('should display the notes text field empty', async () => {
      const expectedNotes = 'expected notes'
      const expectedLab = { ...mockLab, notes: [expectedNotes] } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

      const notesTextField = wrapper.find(TextFieldWithLabelFormGroup).at(1)

      expect(notesTextField).toBeDefined()
      expect(notesTextField.prop('value')).toEqual('')
    })

    it('should display errors', async () => {
      const expectedLab = { ...mockLab, status: 'requested' } as Lab
      const { wrapper } = await setup(expectedLab, [Permissions.ViewLab, Permissions.CompleteLab])

      const expectedError = { message: 'some message', result: 'some result feedback' } as LabError
      jest.spyOn(validateUtil, 'validateLabComplete').mockReturnValue(expectedError)

      const completeButton = wrapper.find(Button).at(1)
      await act(async () => {
        const onClick = completeButton.prop('onClick') as any
        await onClick()
      })
      wrapper.update()

      const alert = wrapper.find(Alert)
      const resultTextField = wrapper.find(TextFieldWithLabelFormGroup).at(0)
      expect(alert.prop('message')).toEqual(expectedError.message)
      expect(alert.prop('title')).toEqual('states.error')
      expect(alert.prop('color')).toEqual('danger')
      expect(resultTextField.prop('isInvalid')).toBeTruthy()
      expect(resultTextField.prop('feedback')).toEqual(expectedError.result)
    })

    describe('requested lab request', () => {
      it('should display a warning badge if the status is requested', async () => {
        const expectedLab = { ...mockLab, status: 'requested' } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
        const labStatusDiv = wrapper.find('.lab-status')
        const badge = labStatusDiv.find(Badge)
        expect(labStatusDiv.find('h4').text().trim()).toEqual('labs.lab.status')

        expect(badge.prop('color')).toEqual('warning')
        expect(badge.text().trim()).toEqual(expectedLab.status)
      })

      it('should display a update lab, complete lab, and cancel lab button if the lab is in a requested state', async () => {
        const { wrapper } = await setup(mockLab, [
          Permissions.ViewLab,
          Permissions.CompleteLab,
          Permissions.CancelLab,
        ])

        const buttons = wrapper.find(Button)
        expect(buttons.at(0).text().trim()).toEqual('labs.requests.update')

        expect(buttons.at(1).text().trim()).toEqual('labs.requests.complete')

        expect(buttons.at(2).text().trim()).toEqual('labs.requests.cancel')
      })
    })

    describe('canceled lab request', () => {
      it('should display a danger badge if the status is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

        const labStatusDiv = wrapper.find('.lab-status')
        const badge = labStatusDiv.find(Badge)
        expect(labStatusDiv.find('h4').text().trim()).toEqual('labs.lab.status')

        expect(badge.prop('color')).toEqual('danger')
        expect(badge.text().trim()).toEqual(expectedLab.status)
      })

      it('should display the canceled on date if the lab request has been canceled', async () => {
        const expectedLab = {
          ...mockLab,
          status: 'canceled',
          canceledOn: '2020-03-30T04:45:20.102Z',
        } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
        const canceledOnDiv = wrapper.find('.canceled-on')

        expect(canceledOnDiv.find('h4').text().trim()).toEqual('labs.lab.canceledOn')

        expect(canceledOnDiv.find('h5').text().trim()).toEqual(
          format(new Date(expectedLab.canceledOn as string), 'yyyy-MM-dd hh:mm a'),
        )
      })

      it('should not display update, complete, and cancel button if the lab is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab

        const { wrapper } = await setup(expectedLab, [
          Permissions.ViewLab,
          Permissions.CompleteLab,
          Permissions.CancelLab,
        ])

        const buttons = wrapper.find(Button)
        expect(buttons).toHaveLength(0)
      })

      it('should not display an update button if the lab is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

        const updateButton = wrapper.find(Button)
        expect(updateButton).toHaveLength(0)
      })

      it('should not display notes text field if the status is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab

        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])

        const textsField = wrapper.find(TextFieldWithLabelFormGroup)
        const notesTextField = wrapper.find('notesTextField')

        expect(textsField.length).toBe(1)
        expect(notesTextField).toHaveLength(0)
      })
    })

    describe('completed lab request', () => {
      it('should display a primary badge if the status is completed', async () => {
        jest.resetAllMocks()
        const expectedLab = { ...mockLab, status: 'completed' } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
        const labStatusDiv = wrapper.find('.lab-status')
        const badge = labStatusDiv.find(Badge)
        expect(labStatusDiv.find('h4').text().trim()).toEqual('labs.lab.status')

        expect(badge.prop('color')).toEqual('primary')
        expect(badge.text().trim()).toEqual(expectedLab.status)
      })

      it('should display the completed on date if the lab request has been completed', async () => {
        const expectedLab = {
          ...mockLab,
          status: 'completed',
          completedOn: '2020-03-30T04:44:20.102Z',
        } as Lab
        const { wrapper } = await setup(expectedLab, [Permissions.ViewLab])
        const completedOnDiv = wrapper.find('.completed-on')

        expect(completedOnDiv.find('h4').text().trim()).toEqual('labs.lab.completedOn')

        expect(completedOnDiv.find('h5').text().trim()).toEqual(
          format(new Date(expectedLab.completedOn as string), 'yyyy-MM-dd hh:mm a'),
        )
      })

      it('should not display update, complete, and cancel buttons if the lab is completed', async () => {
        const expectedLab = { ...mockLab, status: 'completed' } as Lab

        const { wrapper } = await setup(expectedLab, [
          Permissions.ViewLab,
          Permissions.CompleteLab,
          Permissions.CancelLab,
        ])

        const buttons = wrapper.find(Button)
        expect(buttons).toHaveLength(0)
      })

      it('should not display notes text field if the status is completed', async () => {
        const expectedLab = { ...mockLab, status: 'completed' } as Lab

        const { wrapper } = await setup(expectedLab, [
          Permissions.ViewLab,
          Permissions.CompleteLab,
          Permissions.CancelLab,
        ])

        const textsField = wrapper.find(TextFieldWithLabelFormGroup)
        const notesTextField = wrapper.find('notesTextField')

        expect(textsField.length).toBe(1)
        expect(notesTextField).toHaveLength(0)
      })
    })
  })

  describe('on update', () => {
    it('should update the lab with the new information', async () => {
      const { wrapper } = await setup(mockLab, [Permissions.ViewLab])
      const expectedResult = 'expected result'
      const newNotes = 'expected notes'

      const resultTextField = wrapper.find(TextFieldWithLabelFormGroup).at(0)
      act(() => {
        const onChange = resultTextField.prop('onChange') as any
        onChange({ currentTarget: { value: expectedResult } })
      })
      wrapper.update()

      const notesTextField = wrapper.find(TextFieldWithLabelFormGroup).at(1)
      act(() => {
        const onChange = notesTextField.prop('onChange') as any
        onChange({ currentTarget: { value: newNotes } })
      })
      wrapper.update()
      const updateButton = wrapper.find(Button)
      await act(async () => {
        const onClick = updateButton.prop('onClick') as any
        onClick()
      })

      const expectedNotes = mockLab.notes ? [...mockLab.notes, newNotes] : [newNotes]

      expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
      expect(labRepositorySaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ...mockLab, result: expectedResult, notes: expectedNotes }),
      )
      expect(history.location.pathname).toEqual('/labs/12456')
    })
  })

  describe('on complete', () => {
    it('should mark the status as completed and fill in the completed date with the current time', async () => {
      const { wrapper } = await setup(mockLab, [
        Permissions.ViewLab,
        Permissions.CompleteLab,
        Permissions.CancelLab,
      ])
      const expectedResult = 'expected result'

      const resultTextField = wrapper.find(TextFieldWithLabelFormGroup).at(0)
      await act(async () => {
        const onChange = resultTextField.prop('onChange') as any
        await onChange({ currentTarget: { value: expectedResult } })
      })
      wrapper.update()

      const completeButton = wrapper.find(Button).at(1)
      await act(async () => {
        const onClick = completeButton.prop('onClick') as any
        await onClick()
      })
      wrapper.update()

      expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
      expect(labRepositorySaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockLab,
          result: expectedResult,
          status: 'completed',
          completedOn: expectedDate.toISOString(),
        }),
      )
      expect(history.location.pathname).toEqual('/labs/12456')
    })
  })

  describe('on cancel', () => {
    it('should mark the status as canceled and fill in the cancelled on date with the current time', async () => {
      const { wrapper } = await setup(mockLab, [
        Permissions.ViewLab,
        Permissions.CompleteLab,
        Permissions.CancelLab,
      ])
      const expectedResult = 'expected result'

      const resultTextField = wrapper.find(TextFieldWithLabelFormGroup).at(0)
      await act(async () => {
        const onChange = resultTextField.prop('onChange') as any
        await onChange({ currentTarget: { value: expectedResult } })
      })
      wrapper.update()

      const cancelButton = wrapper.find(Button).at(2)
      await act(async () => {
        const onClick = cancelButton.prop('onClick') as any
        await onClick()
      })
      wrapper.update()

      expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
      expect(labRepositorySaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockLab,
          result: expectedResult,
          status: 'canceled',
          canceledOn: expectedDate.toISOString(),
        }),
      )
      expect(history.location.pathname).toEqual('/labs')
    })
  })
})
