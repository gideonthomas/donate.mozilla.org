import React from 'react';
import Modal from '../components/modal.js';
import amountModifier from '../lib/amount-modifier.js';
import currencyData from '../data/currencies.js';
import submit from '../lib/submit';
import ErrorMessage from './error.js';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import reactGA from 'react-ga';

var NOT_SUBMITTING = 0;
var STRIPE_SUBMITTING = 2;

var MonthlyUpsell = React.createClass({
  contextTypes: {
    intl: React.PropTypes.object
  },
  getInitialState: function() {
    return {
      inputValue: this.props.suggestedMonthly,
      currencyCode: this.props.currencyCode,
      customerId: this.props.customerId,
      amountError: "",
      stripeError: "",
      submitting: NOT_SUBMITTING
    };
  },
  onInputChange: function(e) {
    var inputValue = e.currentTarget.value;
    var amount = "";

    // Pull this into a shared function.
    if (/^[\d]*[\.]?\d{0,2}$/.test(inputValue)) {
      amount = inputValue.replace(/,/g, "");
    } else if (/^[\d]*[,]?\d{0,2}$/.test(inputValue)) {
      amount = inputValue.replace(/\./g, "").replace(",", ".");
    } else if (/^[\d,]*[\.]?\d{0,2}$/.test(inputValue)) {
      amount = inputValue.replace(/,/g, "");
    } else if (/^[\d\.]*[,]?\d{0,2}$/.test(inputValue)) {
      amount = inputValue.replace(/\./g, "").replace(",", ".");
    } else {
      inputValue = this.state.inputValue;
    }

    if (this.state.inputValue !== inputValue) {
      this.setState({
        inputValue: inputValue,
        amountError: ""
      });
    }
    this.setState({amount});
  },
  submit: function() {
    let currencyCode = this.state.currencyCode;

    if (!this.validateAmount() || this.state.submitting === STRIPE_SUBMITTING) {
      return;
    }

    this.setState({
      submitting: STRIPE_SUBMITTING
    });

    submit("/api/stripe-monthly-upsell", {
      customerId: this.state.customerId,
      currency: this.state.currencyCode,
      amount: amountModifier.stripe(this.state.inputValue, currencyCode),
      locale: this.context.intl.locale,
      description: this.context.intl.formatMessage({id: "mozilla_monthly_donation"})
    }, (data) => {
      var transactionId = data.id;
      var amount;
      var currency;
      var donationFrequency = data.frequency;

      if (donationFrequency === "monthly") {
        currency = data.currency;
        // Stripe plans are a multiple of the currencies equivilent of Cents
        // e.g. £5/month = 500 £0.01 subscriptions
        amount = data.quantity;
      } else {
        amount = data.amount;
        currency = data.currency;
      }

      var params = '?payment=Stripe&str_amount=' + amount + '&str_currency=' + currency + '&str_id=' +transactionId + '&str_frequency=' + donationFrequency;
      var page = '/' + this.context.intl.locale + '/thank-you/';
      window.location = page + params;
    }, (response) => {
      var errorCode = error(response.error);
      if (response.stripe) {
        errorCode = response.stripe.rawType;
      }

      this.setState({
        submitting: NOT_SUBMITTING,
        stripeError: this.context.intl.formatMessage({id: 'could_not_complete'}) + " [" + errorCode + "]"
      });
      reactGA.event({
        category: "User Flow",
        action: "Card Error",
        label: errorCode
      });
    });
  },
  validateAmount: function() {
    var currency = currencyData[this.state.currencyCode];
    var amount = parseInt(this.state.inputValue, 10);
    var minAmount = parseInt(currency.minAmount, 10);

    var errorMessage = "";
    if (!amount) {
      errorMessage = 'please_select_an_amount';
    } else if (amount < minAmount) {
      errorMessage = 'donation_min_error';
    }
    if (errorMessage) {
      this.setState({
        submitting: NOT_SUBMITTING,
        amountError: errorMessage
      });
      return false;
    }
    return true;
  },
  render: function() {
    var currency = currencyData[this.state.currencyCode];
    var currencySymbol = currency.symbol;
    var amountError = this.state.amountError;
    var stripeError = this.state.stripeError;

    var amountErrorElement = null;
    if (amountError) {
      if (amountError === 'donation_min_error') {
        amountErrorElement = (
          <ErrorMessage message={(
            <FormattedMessage
              id={amountError}
              values={{minAmount:
                <span>
                  { currency.code ?
                  <FormattedNumber
                    maximumFractionDigits={2}
                    value={currency.minAmount}
                    style="currency"
                    currency={currency.code}
                  /> : "" }
                </span>
              }}
            />
          )}/>
        );
      } else {
        amountErrorElement = (
          <ErrorMessage message={this.context.intl.formatMessage({id: amountError})}/>
        );
      }
    }
    var stripeErrorElement = null;
    if (stripeError) {
      stripeErrorElement = (
        <ErrorMessage message={stripeError}/>
      );
    }
    return (
      <div className="upsell-container">
        <Modal>
          <div className="upsell-modal">
            <div className="upsell-ask">
              <p>
                <b>Thank you!</b> We’d love to have you as a sustaining supporter of Mozilla.
              </p>
              <p>
                Could you add a {currencySymbol} <input value={this.state.inputValue} onChange={this.onInputChange}/> monthly donation starting next month?
              </p>
            </div>
            {amountErrorElement}
            {stripeErrorElement}
            <button onClick={this.submit} className="yes-button">YES</button>
            <button onClick={this.props.onClose} className="no-button">NO</button>
          </div>
        </Modal>
      </div>
    );
  }
});

module.exports = MonthlyUpsell;
